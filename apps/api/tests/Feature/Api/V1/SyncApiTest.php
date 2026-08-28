<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyncApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_submits_and_retries_a_command_then_reads_user_scoped_changes(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $command = $this->command();

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertOk()->assertJsonPath('data.results.0.version', 1)->assertJsonPath('data.results.0.duplicate', false);
        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertOk()->assertJsonPath('data.results.0.duplicate', true);
        $this->getJson('/api/v1/sync?after=0&limit=1')
            ->assertOk()->assertJsonPath('data.changes.0.aggregate_id', $command['aggregate_id'])
            ->assertJsonPath('data.next_cursor', 1)->assertJsonPath('data.has_more', false);
    }

    public function test_preserves_hashed_script_text_byte_for_byte_during_sync(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $sourceText = "# Синтетический сценарий\n\n## Блок\n\n  Исходный текст.  \n";
        $fullText = '  Синтетический блок с Markdown-пробелами.  ';
        $command['payload']['source_text'] = $sourceText;
        $command['payload']['cards'][0]['full_text'] = $fullText;
        $command['payload']['cards'][0]['content_hash'] = hash('sha256', $fullText);
        $command['payload']['cards'][0]['cue_set']['source_hash'] = hash('sha256', $fullText);

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertOk();

        $this->assertDatabaseHas('scripts', [
            'id' => $command['aggregate_id'],
            'source_text' => $sourceText,
        ]);
        $this->assertDatabaseHas('cards', [
            'id' => $command['payload']['cards'][0]['id'],
            'full_text' => $fullText,
            'content_hash' => hash('sha256', $fullText),
        ]);
    }

    public function test_returns_stable_conflict_and_rejects_oversized_batches(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $command = $this->command();
        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])->assertOk();
        $stale = $command;
        $stale['operation_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2';
        $stale['payload']['title'] = 'Локальная версия';

        $this->postJson('/api/v1/sync/commands', ['commands' => [$stale]])
            ->assertConflict()->assertJsonPath('error.code', 'SYNC_VERSION_CONFLICT')
            ->assertJsonPath('error.conflict.local.title', 'Локальная версия')
            ->assertJsonPath('error.conflict.server.title', 'Синтетический сценарий');
        $this->postJson('/api/v1/sync/commands', ['commands' => array_fill(0, 21, $command)])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_paginates_only_the_authenticated_users_change_feed(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Sanctum::actingAs($other);
        $otherCommand = $this->command();
        $otherCommand['operation_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1c3';
        $otherCommand['aggregate_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1c2';
        $otherCommand['payload']['id'] = $otherCommand['aggregate_id'];
        $otherCommand['payload']['cards'][0]['id'] = '0198a70e-23a2-73df-8387-34636552834a';
        $otherCommand['payload']['cards'][0]['script_id'] = $otherCommand['aggregate_id'];
        $otherCommand['payload']['cards'][0]['cue_set']['id'] = '0198a70e-5670-704a-86bb-ced23df0706f';
        $otherCommand['payload']['cards'][0]['cue_set']['card_id'] = $otherCommand['payload']['cards'][0]['id'];
        $this->postJson('/api/v1/sync/commands', ['commands' => [$otherCommand]])->assertOk();

        Sanctum::actingAs($user);
        $first = $this->command();
        $second = $first;
        $second['operation_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2';
        $second['base_version'] = 1;
        $second['payload']['version'] = 1;
        $second['payload']['title'] = 'Вторая версия';
        $this->postJson('/api/v1/sync/commands', ['commands' => [$first, $second]])->assertOk();

        $firstPage = $this->getJson('/api/v1/sync?after=0&limit=1')
            ->assertOk()->assertJsonPath('data.changes.0.aggregate_id', $first['aggregate_id'])
            ->assertJsonPath('data.has_more', true);
        $cursor = $firstPage->json('data.next_cursor');

        $this->getJson("/api/v1/sync?after={$cursor}&limit=1")
            ->assertOk()->assertJsonCount(1, 'data.changes')
            ->assertJsonPath('data.changes.0.version', 2)
            ->assertJsonPath('data.has_more', false);
    }

    public function test_rejects_a_snapshot_larger_than_256_kib(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $command['payload']['source_text'] = str_repeat('я', 131073);

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rate_limits_sync_per_authenticated_user(): void
    {
        Sanctum::actingAs(User::factory()->create());

        for ($request = 1; $request <= 60; $request++) {
            $this->getJson('/api/v1/sync')->assertOk();
        }

        $this->getJson('/api/v1/sync')
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/sync')->assertOk();
    }

    public function test_returns_the_correlation_id_and_logs_only_safe_sync_context(): void
    {
        $records = [];
        Event::listen(MessageLogged::class, static function (MessageLogged $event) use (&$records): void {
            if ($event->message === 'sync.operation') {
                $records[] = $event->context;
            }
        });
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $command = $this->command();
        $sentinel = 'СЕКРЕТНЫЙ ТЕКСТ СЦЕНАРИЯ';
        $command['payload']['source_text'] = $sentinel;
        $correlationId = '0198a70e-95b2-7642-a06f-aa4a42f0492a';

        $this->withHeader('X-Correlation-ID', $correlationId)
            ->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertOk()
            ->assertHeader('X-Correlation-ID', $correlationId);

        $this->assertCount(1, $records);
        $context = $records[0];
        $keys = array_keys($context);
        sort($keys);
        $this->assertSame([
            'aggregate_id', 'base_version', 'correlation_id', 'operation_id',
            'outcome', 'result_version', 'user_id',
        ], $keys);
        $this->assertSame('applied', $context['outcome']);
        $this->assertSame($correlationId, $context['correlation_id']);
        $this->assertStringNotContainsString($sentinel, json_encode($records, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    public function test_rejects_non_object_commands_with_a_stable_validation_error(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/sync/commands', ['commands' => ['not-an-object']])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rejects_a_scalar_commands_root_with_a_stable_validation_error(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/sync/commands', ['commands' => 'not-an-array'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rejects_a_malformed_hash_with_a_stable_validation_error(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $command['payload']['import_hash'] = 'not-a-hash';

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rejects_a_nonzero_base_version_for_a_missing_aggregate(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $command['base_version'] = 3;
        $command['payload']['version'] = 3;

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rejects_a_non_rfc3339_command_timestamp(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $command['created_at'] = 'tomorrow';

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_rejects_an_incoherent_snapshot_with_a_stable_validation_error(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $command = $this->command();
        $command['payload']['cards'][0]['content_hash'] = str_repeat('0', 64);

        $this->postJson('/api/v1/sync/commands', ['commands' => [$command]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /** @return array<string, mixed> */
    private function command(): array
    {
        $script = '0198a70d-a717-70ae-a41d-905a2237bd18';
        $card = '0198a70e-23a2-73df-8387-34636552833a';
        $text = 'Первый синтетический блок.';
        $hash = hash('sha256', $text);

        return ['operation_id' => '0198a70d-4f72-70ad-bb3f-35b64f6ee1b1', 'aggregate_id' => $script, 'type' => 'script.replace', 'base_version' => 0, 'created_at' => '2026-08-07T09:00:00+00:00', 'payload' => [
            'id' => $script, 'title' => 'Синтетический сценарий', 'source_format' => 'markdown', 'source_text' => $text,
            'import_hash' => hash('sha256', 'import'), 'status' => 'ready', 'version' => 0, 'last_opened_at' => null,
            'updated_at' => '2026-08-07T09:00:00+00:00', 'deleted_at' => null, 'cards' => [[
                'id' => $card, 'script_id' => $script, 'position' => 0, 'title' => 'Блок', 'full_text' => $text,
                'content_hash' => $hash, 'version' => 0, 'deleted_at' => null, 'cue_set' => ['id' => '0198a70e-5670-704a-86bb-ced23df0704f', 'card_id' => $card, 'cues' => ['Один', 'Два', 'Три'], 'source_hash' => $hash, 'status' => 'ready', 'generation_id' => null, 'manually_edited' => false, 'version' => 0],
            ]],
        ]];
    }
}
