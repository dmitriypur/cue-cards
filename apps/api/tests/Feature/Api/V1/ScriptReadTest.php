<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScriptReadTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_reads_cards_in_position_order_with_their_cues(): void
    {
        $owner = User::factory()->create();
        $scriptId = $this->createScript($owner, 'Сценарий владельца');
        $secondCard = $this->createCard($scriptId, 1, 'Второй блок');
        $firstCard = $this->createCard($scriptId, 0, 'Первый блок');
        $this->createCueSet($firstCard, ['Первый тезис', 'Второй тезис', 'Третий тезис']);

        Sanctum::actingAs($owner);

        $this->getJson("/api/v1/scripts/{$scriptId}")
            ->assertOk()
            ->assertJsonPath('data.id', $scriptId)
            ->assertJsonPath('data.cards.0.id', $firstCard)
            ->assertJsonPath('data.cards.0.cue_set.cues.0', 'Первый тезис')
            ->assertJsonPath('data.cards.1.id', $secondCard);
    }

    public function test_another_user_receives_not_found_without_nested_data_leakage(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $scriptId = $this->createScript($owner, 'Секретный сценарий');
        $cardId = $this->createCard($scriptId, 0, 'Секретный блок');
        $this->createCueSet($cardId, ['Один', 'Два', 'Три']);

        Sanctum::actingAs($other);

        $response = $this->getJson("/api/v1/scripts/{$scriptId}")
            ->assertNotFound()
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
        $this->assertStringNotContainsString('Секретный блок', $response->getContent());
    }

    public function test_soft_deleted_script_is_hidden_from_its_owner(): void
    {
        $owner = User::factory()->create();
        $scriptId = $this->createScript($owner, 'Удалённый сценарий');
        DB::table('scripts')->where('id', $scriptId)->update(['deleted_at' => now()]);

        Sanctum::actingAs($owner);

        $this->getJson("/api/v1/scripts/{$scriptId}")
            ->assertNotFound()
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');
    }

    private function createScript(User $owner, string $title): string
    {
        $id = (string) Str::uuid();
        DB::table('scripts')->insert([
            'id' => $id,
            'user_id' => $owner->id,
            'title' => $title,
            'source_format' => 'markdown',
            'source_text' => "# {$title}",
            'import_hash' => str_repeat('a', 64),
            'status' => 'draft',
            'version' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function createCard(string $scriptId, int $position, string $title): string
    {
        $id = (string) Str::uuid();
        DB::table('cards')->insert([
            'id' => $id,
            'script_id' => $scriptId,
            'position' => $position,
            'title' => $title,
            'full_text' => "Текст: {$title}",
            'content_hash' => str_repeat((string) ($position + 1), 64),
            'version' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    /** @param list<string> $cues */
    private function createCueSet(string $cardId, array $cues): void
    {
        DB::table('cue_sets')->insert([
            'id' => (string) Str::uuid(),
            'card_id' => $cardId,
            'cues' => json_encode($cues, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'source_hash' => str_repeat('1', 64),
            'status' => 'ready',
            'manually_edited' => false,
            'version' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
