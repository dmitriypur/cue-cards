<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Identity\Role;
use App\Jobs\GenerateScriptCues;
use App\Models\Card;
use App\Models\CueSet;
use App\Models\Script;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiGenerationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_owner_starts_script_generation_without_exposing_provider_secrets(): void
    {
        Queue::fake();
        [$user, $script, $cards] = $this->scriptWithCards(Role::Superadmin);
        config()->set('cue-cards.ai.model', 'secret-model-name');
        config()->set('ai.providers.deepseek.key', 'secret-provider-key');
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")
            ->assertAccepted()
            ->assertJsonPath('data.script_id', $script->id)
            ->assertJsonPath('data.card_id', null)
            ->assertJsonPath('data.status', 'queued')
            ->assertJsonPath('data.completed_cards', 0)
            ->assertJsonPath('data.total_cards', 2);

        $serialized = $response->getContent();
        $this->assertStringNotContainsString('secret-model-name', $serialized);
        $this->assertStringNotContainsString('secret-provider-key', $serialized);
        foreach ($cards as $card) {
            $this->assertDatabaseHas('cue_sets', [
                'card_id' => $card->id,
                'status' => 'pending',
                'generation_id' => $response->json('data.id'),
            ]);
        }
        Queue::assertPushed(GenerateScriptCues::class, 1);
    }

    public function test_superadmin_owner_can_start_one_card_and_read_generation_status(): void
    {
        Queue::fake();
        [$user, $script, $cards] = $this->scriptWithCards(Role::Superadmin);
        Sanctum::actingAs($user);

        $generationId = $this->postJson("/api/v1/cards/{$cards[0]->id}/cue-generations")
            ->assertAccepted()
            ->assertJsonPath('data.script_id', $script->id)
            ->assertJsonPath('data.card_id', $cards[0]->id)
            ->assertJsonPath('data.total_cards', 1)
            ->json('data.id');

        $this->getJson("/api/v1/ai-generations/{$generationId}")
            ->assertOk()
            ->assertJsonPath('data.id', $generationId)
            ->assertJsonPath('data.status', 'queued');
    }

    public function test_another_users_script_and_generation_are_hidden(): void
    {
        Queue::fake();
        [$owner, $script] = $this->scriptWithCards(Role::Superadmin);
        Sanctum::actingAs($owner);
        $generationId = $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")
            ->assertAccepted()->json('data.id');

        Sanctum::actingAs(User::factory()->create(['role' => Role::Superadmin]));
        $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")->assertNotFound();
        $this->getJson("/api/v1/ai-generations/{$generationId}")->assertNotFound();
    }

    public function test_user_without_ai_entitlement_cannot_start_generation(): void
    {
        Queue::fake();
        [$user, $script] = $this->scriptWithCards(Role::User);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")->assertForbidden();
        $this->assertDatabaseCount('ai_generations', 0);
        Queue::assertNothingPushed();
    }

    public function test_technical_rate_limit_applies_to_superadmin(): void
    {
        Queue::fake();
        [$user, $script] = $this->scriptWithCards(Role::Superadmin);
        Sanctum::actingAs($user);

        for ($request = 1; $request <= 10; $request++) {
            $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")->assertAccepted();
        }

        $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    public function test_status_polling_uses_a_separate_higher_technical_limit(): void
    {
        Queue::fake();
        [$user, $script] = $this->scriptWithCards(Role::Superadmin);
        Sanctum::actingAs($user);
        $generationId = $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")
            ->assertAccepted()->json('data.id');

        for ($poll = 1; $poll <= 20; $poll++) {
            $this->getJson("/api/v1/ai-generations/{$generationId}")->assertOk();
        }

        $this->postJson("/api/v1/scripts/{$script->id}/cue-generations")->assertAccepted();
    }

    /** @return array{User, Script, list<Card>} */
    private function scriptWithCards(Role $role): array
    {
        $user = User::factory()->create(['role' => $role]);
        $script = Script::query()->create([
            'user_id' => $user->id,
            'title' => 'Синтетический сценарий',
            'source_format' => 'markdown',
            'source_text' => 'Синтетический исходный текст.',
            'import_hash' => hash('sha256', 'synthetic import'),
            'status' => 'ready',
            'version' => 1,
        ]);
        $cards = [];
        foreach (['Первый блок.', 'Второй блок.'] as $position => $text) {
            $card = Card::query()->create([
                'script_id' => $script->id,
                'position' => $position,
                'title' => 'Блок '.($position + 1),
                'full_text' => $text,
                'content_hash' => hash('sha256', $text),
                'version' => 1,
            ]);
            CueSet::query()->create([
                'card_id' => $card->id,
                'cues' => [],
                'source_hash' => null,
                'status' => 'missing',
                'generation_id' => null,
                'manually_edited' => false,
                'version' => 1,
            ]);
            $cards[] = $card;
        }

        return [$user, $script, $cards];
    }
}
