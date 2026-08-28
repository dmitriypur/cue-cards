<?php

namespace Tests\Integration\Sync;

use App\Application\Sync\InvalidSyncCommand;
use App\Application\Sync\SubmitSyncCommands;
use App\Application\Sync\SyncConflict;
use App\Domain\AiAssistance\GenerationStatus;
use App\Models\AiGeneration;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SubmitSyncCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_applies_a_snapshot_once_and_returns_the_original_result_for_an_exact_retry(): void
    {
        $user = User::factory()->create();
        $command = $this->command();
        $action = app(SubmitSyncCommands::class);

        $first = $action->handle($user, [$command]);
        $retry = $action->handle($user, [$command]);

        $this->assertSame(1, $first->results[0]->version);
        $this->assertFalse($first->results[0]->duplicate);
        $this->assertTrue($retry->results[0]->duplicate);
        $this->assertDatabaseHas('scripts', ['id' => $command['aggregate_id'], 'user_id' => $user->id, 'version' => 1]);
        $this->assertDatabaseCount('sync_operations', 1);
        $this->assertDatabaseCount('sync_changes', 1);
    }

    public function test_rejects_a_non_rfc3339_command_timestamp_at_the_application_boundary(): void
    {
        $command = $this->command();
        $command['created_at'] = 'tomorrow';

        $this->expectException(InvalidSyncCommand::class);
        app(SubmitSyncCommands::class)->handle(User::factory()->create(), [$command]);
    }

    public function test_applies_commands_in_request_order(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        $second = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 1);
        $second['payload']['id'] = $first['aggregate_id'];
        $second['aggregate_id'] = $first['aggregate_id'];
        $second['payload']['title'] = 'Вторая версия';

        $result = app(SubmitSyncCommands::class)->handle($user, [$first, $second]);

        $this->assertSame([1, 2], array_map(static fn ($item) => $item->version, $result->results));
        $this->assertDatabaseHas('scripts', ['id' => $first['aggregate_id'], 'title' => 'Вторая версия', 'version' => 2]);
        $this->assertSame([1, 2], DB::table('sync_changes')->orderBy('cursor')->pluck('version')->all());
    }

    public function test_client_snapshot_cannot_clear_a_server_owned_generation_link(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        app(SubmitSyncCommands::class)->handle($user, [$first]);
        $generation = AiGeneration::query()->create([
            'user_id' => $user->id,
            'script_id' => $first['aggregate_id'],
            'provider' => 'deepseek',
            'model' => 'synthetic-model',
            'prompt_version' => '2',
            'source_hashes' => [$first['payload']['cards'][0]['id'] => $first['payload']['cards'][0]['content_hash']],
            'source_cue_versions' => [$first['payload']['cards'][0]['id'] => 0],
            'status' => GenerationStatus::Running,
            'attempts' => 1,
            'completed_cards' => 0,
            'total_cards' => 1,
        ]);
        DB::table('cue_sets')->where('id', $first['payload']['cards'][0]['cue_set']['id'])->update([
            'status' => 'generating',
            'generation_id' => $generation->id,
        ]);

        $laterSnapshot = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 1);
        $laterSnapshot['payload']['version'] = 1;
        $laterSnapshot['payload']['cards'][0]['cue_set']['status'] = 'pending';
        $laterSnapshot['payload']['cards'][0]['cue_set']['generation_id'] = null;
        app(SubmitSyncCommands::class)->handle($user, [$laterSnapshot]);

        $this->assertDatabaseHas('cue_sets', [
            'id' => $first['payload']['cards'][0]['cue_set']['id'],
            'generation_id' => $generation->id,
        ]);
    }

    public function test_client_snapshot_cannot_replace_a_newer_server_generation_link(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        app(SubmitSyncCommands::class)->handle($user, [$first]);
        $cardId = $first['payload']['cards'][0]['id'];
        $generationValues = [
            'user_id' => $user->id,
            'script_id' => $first['aggregate_id'],
            'provider' => 'deepseek',
            'model' => 'synthetic-model',
            'prompt_version' => '2',
            'source_hashes' => [$cardId => $first['payload']['cards'][0]['content_hash']],
            'source_cue_versions' => [$cardId => 0],
            'status' => GenerationStatus::Running,
            'attempts' => 1,
            'completed_cards' => 0,
            'total_cards' => 1,
        ];
        $olderGeneration = AiGeneration::query()->create($generationValues);
        $newerGeneration = AiGeneration::query()->create($generationValues);
        DB::table('cue_sets')->where('id', $first['payload']['cards'][0]['cue_set']['id'])->update([
            'generation_id' => $newerGeneration->id,
        ]);

        $staleSnapshot = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 1);
        $staleSnapshot['payload']['version'] = 1;
        $staleSnapshot['payload']['cards'][0]['cue_set']['generation_id'] = $olderGeneration->id;
        app(SubmitSyncCommands::class)->handle($user, [$staleSnapshot]);

        $this->assertDatabaseHas('cue_sets', [
            'id' => $first['payload']['cards'][0]['cue_set']['id'],
            'generation_id' => $newerGeneration->id,
        ]);
    }

    public function test_denies_replacing_an_aggregate_owned_by_another_user(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $command = $this->command();
        app(SubmitSyncCommands::class)->handle($owner, [$command]);
        $next = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 1);
        $next['aggregate_id'] = $command['aggregate_id'];
        $next['payload']['id'] = $command['aggregate_id'];

        $this->expectException(AuthorizationException::class);
        app(SubmitSyncCommands::class)->handle($other, [$next]);
    }

    public function test_denies_reusing_another_users_card_uuid_without_partial_writes(): void
    {
        $owner = User::factory()->create();
        $attacker = User::factory()->create();
        $owned = $this->command();
        app(SubmitSyncCommands::class)->handle($owner, [$owned]);

        $attackerCommand = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2');
        $attackerCommand['aggregate_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1c2';
        $attackerCommand['payload']['id'] = $attackerCommand['aggregate_id'];
        $attackerCommand['payload']['cards'][0]['id'] = $owned['payload']['cards'][0]['id'];
        $attackerCommand['payload']['cards'][0]['script_id'] = $attackerCommand['aggregate_id'];
        $attackerCommand['payload']['cards'][0]['cue_set']['id'] = '0198a70e-5670-704a-86bb-ced23df0706f';
        $attackerCommand['payload']['cards'][0]['cue_set']['card_id'] = $attackerCommand['payload']['cards'][0]['id'];

        try {
            app(SubmitSyncCommands::class)->handle($attacker, [$attackerCommand]);
            $this->fail('Expected nested UUID ownership to be enforced.');
        } catch (AuthorizationException) {
            // Expected: ownership is rejected before any aggregate rows are changed.
        }

        $this->assertDatabaseHas('cards', [
            'id' => $owned['payload']['cards'][0]['id'],
            'script_id' => $owned['aggregate_id'],
        ]);
        $this->assertDatabaseMissing('scripts', ['id' => $attackerCommand['aggregate_id']]);
        $this->assertDatabaseCount('sync_operations', 1);
        $this->assertDatabaseCount('sync_changes', 1);
    }

    public function test_denies_reusing_another_users_cue_set_uuid_without_partial_writes(): void
    {
        $owner = User::factory()->create();
        $attacker = User::factory()->create();
        $owned = $this->command();
        app(SubmitSyncCommands::class)->handle($owner, [$owned]);

        $attackerCommand = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2');
        $attackerCommand['aggregate_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1c2';
        $attackerCommand['payload']['id'] = $attackerCommand['aggregate_id'];
        $attackerCommand['payload']['cards'][0]['id'] = '0198a70e-23a2-73df-8387-34636552834a';
        $attackerCommand['payload']['cards'][0]['script_id'] = $attackerCommand['aggregate_id'];
        $attackerCommand['payload']['cards'][0]['cue_set']['id'] = $owned['payload']['cards'][0]['cue_set']['id'];
        $attackerCommand['payload']['cards'][0]['cue_set']['card_id'] = $attackerCommand['payload']['cards'][0]['id'];

        try {
            app(SubmitSyncCommands::class)->handle($attacker, [$attackerCommand]);
            $this->fail('Expected nested cue-set UUID ownership to be enforced.');
        } catch (AuthorizationException) {
            // Expected: ownership is rejected before any aggregate rows are changed.
        }

        $this->assertDatabaseHas('cue_sets', [
            'id' => $owned['payload']['cards'][0]['cue_set']['id'],
            'card_id' => $owned['payload']['cards'][0]['id'],
        ]);
        $this->assertDatabaseMissing('scripts', ['id' => $attackerCommand['aggregate_id']]);
        $this->assertDatabaseCount('sync_operations', 1);
        $this->assertDatabaseCount('sync_changes', 1);
    }

    public function test_returns_both_snapshots_on_a_stale_base_without_writing_the_loser(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        app(SubmitSyncCommands::class)->handle($user, [$first]);
        $stale = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 0);
        $stale['aggregate_id'] = $first['aggregate_id'];
        $stale['payload']['id'] = $first['aggregate_id'];
        $stale['payload']['title'] = 'Проигравшая локальная версия';

        try {
            app(SubmitSyncCommands::class)->handle($user, [$stale]);
            $this->fail('Expected a sync conflict.');
        } catch (SyncConflict $conflict) {
            $this->assertSame('Проигравшая локальная версия', $conflict->local->toArray()['title']);
            $this->assertSame('Синтетический сценарий', $conflict->server->toArray()['title']);
        }

        $this->assertDatabaseHas('scripts', ['id' => $first['aggregate_id'], 'title' => 'Синтетический сценарий', 'version' => 1]);
        $this->assertDatabaseCount('sync_operations', 1);
        $this->assertDatabaseCount('sync_changes', 1);
    }

    public function test_applies_a_coherent_soft_delete_snapshot(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        app(SubmitSyncCommands::class)->handle($user, [$first]);
        $deleted = $this->command('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2', 1);
        $deleted['aggregate_id'] = $first['aggregate_id'];
        $deleted['payload']['id'] = $first['aggregate_id'];
        $deleted['payload']['deleted_at'] = '2026-08-07T10:00:00+00:00';

        $result = app(SubmitSyncCommands::class)->handle($user, [$deleted]);

        $this->assertSame(2, $result->results[0]->version);
        $this->assertNotNull(DB::table('scripts')->where('id', $first['aggregate_id'])->value('deleted_at'));
        $this->assertNull(DB::table('cards')->where('script_id', $first['aggregate_id'])->value('deleted_at'));
    }

    public function test_preserves_a_tombstones_position_when_an_active_card_reuses_it(): void
    {
        $user = User::factory()->create();
        $first = $this->command();
        $secondCard = $first['payload']['cards'][0];
        $secondCard['id'] = '0198a70e-23a2-73df-8387-34636552834a';
        $secondCard['position'] = 1;
        $secondCard['title'] = 'Второй блок';
        $secondCard['cue_set']['id'] = '0198a70e-5670-704a-86bb-ced23df0706f';
        $secondCard['cue_set']['card_id'] = $secondCard['id'];
        $first['payload']['cards'][] = $secondCard;
        app(SubmitSyncCommands::class)->handle($user, [$first]);

        $deleted = $first;
        $deleted['operation_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2';
        $deleted['base_version'] = 1;
        $deleted['payload']['version'] = 1;
        $deleted['payload']['cards'][0]['deleted_at'] = '2026-08-07T10:00:00+00:00';
        $deleted['payload']['cards'][1]['position'] = 0;

        $result = app(SubmitSyncCommands::class)->handle($user, [$deleted]);

        $this->assertSame(2, $result->results[0]->version);
        $this->assertDatabaseHas('cards', [
            'id' => $deleted['payload']['cards'][0]['id'],
            'position' => 0,
        ]);
        $this->assertDatabaseHas('cards', [
            'id' => $deleted['payload']['cards'][1]['id'],
            'position' => 0,
        ]);
    }

    /** @return array<string, mixed> */
    private function command(string $operationId = '0198a70d-4f72-70ad-bb3f-35b64f6ee1b1', int $baseVersion = 0): array
    {
        $scriptId = '0198a70d-a717-70ae-a41d-905a2237bd18';
        $cardId = '0198a70e-23a2-73df-8387-34636552833a';
        $text = 'Первый синтетический блок.';
        $hash = hash('sha256', $text);

        return [
            'operation_id' => $operationId,
            'aggregate_id' => $scriptId,
            'type' => 'script.replace',
            'base_version' => $baseVersion,
            'created_at' => '2026-08-07T09:00:00+00:00',
            'payload' => [
                'id' => $scriptId,
                'title' => 'Синтетический сценарий',
                'source_format' => 'markdown',
                'source_text' => "# Синтетический сценарий\n\n## Первый\n\n{$text}",
                'import_hash' => hash('sha256', 'synthetic import'),
                'status' => 'ready',
                'version' => $baseVersion,
                'last_opened_at' => null,
                'updated_at' => '2026-08-07T09:00:00+00:00',
                'deleted_at' => null,
                'cards' => [[
                    'id' => $cardId,
                    'script_id' => $scriptId,
                    'position' => 0,
                    'title' => 'Первый блок',
                    'full_text' => $text,
                    'content_hash' => $hash,
                    'version' => 0,
                    'deleted_at' => null,
                    'cue_set' => [
                        'id' => '0198a70e-5670-704a-86bb-ced23df0704f',
                        'card_id' => $cardId,
                        'cues' => ['Первый тезис', 'Второй тезис', 'Третий тезис'],
                        'source_hash' => $hash,
                        'status' => 'ready',
                        'generation_id' => null,
                        'manually_edited' => false,
                        'version' => 0,
                    ],
                ]],
            ],
        ];
    }
}
