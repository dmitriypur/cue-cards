<?php

namespace App\Application\AiAssistance;

use App\Application\Identity\EntitlementService;
use App\Domain\AiAssistance\GenerationStatus;
use App\Domain\Identity\Feature;
use App\Jobs\GenerateScriptCues;
use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\Script;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CreateCueGeneration
{
    public function __construct(private readonly EntitlementService $entitlements) {}

    /** @param Collection<int, Card> $cards */
    public function handle(User $user, Script $script, Collection $cards, ?Card $singleCard = null): AiGeneration
    {
        if ((int) $script->user_id !== (int) $user->id) {
            throw (new ModelNotFoundException)->setModel(Script::class, [$script->id]);
        }
        if (! $this->entitlements->allows($user, Feature::AiCues)) {
            throw new FeatureNotAvailable('AI cues are not available for this account.');
        }
        if ($cards->isEmpty()) {
            throw new FeatureNotAvailable('There are no cards available for generation.');
        }

        $generation = DB::transaction(function () use ($user, $script, $cards, $singleCard): AiGeneration {
            $generation = AiGeneration::query()->create([
                'user_id' => $user->id,
                'script_id' => $script->id,
                'card_id' => $singleCard?->id,
                'provider' => 'deepseek',
                'model' => (string) config('cue-cards.ai.model'),
                'prompt_version' => (string) config('cue-cards.ai.prompt_version'),
                'source_hashes' => $cards->mapWithKeys(
                    static fn (Card $card): array => [$card->id => $card->content_hash],
                )->all(),
                'status' => GenerationStatus::Queued,
                'attempts' => 0,
                'completed_cards' => 0,
                'total_cards' => $cards->count(),
            ]);

            foreach ($cards as $card) {
                $card->cueSet()->update([
                    'status' => 'pending',
                    'generation_id' => $generation->id,
                ]);
            }

            GenerateScriptCues::dispatch($generation->id)->onQueue('ai')->afterCommit();

            return $generation;
        });

        return $generation->refresh();
    }
}
