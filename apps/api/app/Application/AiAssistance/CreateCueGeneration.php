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
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateCueGeneration
{
    public function __construct(private readonly EntitlementService $entitlements) {}

    /** @param Collection<int, Card> $cards */
    public function handle(
        User $user,
        Script $script,
        Collection $cards,
        ?Card $singleCard = null,
        bool $replaceManual = false,
        ?string $operationId = null,
    ): AiGeneration {
        if ((int) $script->user_id !== (int) $user->id) {
            throw (new ModelNotFoundException)->setModel(Script::class, [$script->id]);
        }
        $existing = $operationId === null ? null : AiGeneration::query()
            ->where('user_id', $user->id)->where('operation_id', $operationId)->first();
        if ($existing !== null) {
            return $this->validateReplay($existing, $script, $singleCard, $replaceManual);
        }
        if (! $this->entitlements->allows($user, Feature::AiCues)) {
            throw new FeatureNotAvailable('AI cues are not available for this account.');
        }
        if ($cards->isEmpty()) {
            throw new FeatureNotAvailable('There are no cards available for generation.');
        }
        if ($singleCard?->cueSet?->manually_edited && ! $replaceManual) {
            throw new ManualCueReplacementRequired('Manual cues require explicit replacement authorization.');
        }

        try {
            $generation = DB::transaction(function () use ($user, $script, $cards, $singleCard, $replaceManual, $operationId): AiGeneration {
                if ($operationId !== null) {
                    $existing = AiGeneration::query()->where('user_id', $user->id)
                        ->where('operation_id', $operationId)->lockForUpdate()->first();
                    if ($existing !== null) {
                        return $this->validateReplay($existing, $script, $singleCard, $replaceManual);
                    }
                }
                $generation = AiGeneration::query()->create([
                    'user_id' => $user->id,
                    'script_id' => $script->id,
                    'card_id' => $singleCard?->id,
                    'operation_id' => $operationId,
                    'replace_manual' => $replaceManual,
                    'provider' => 'deepseek',
                    'model' => (string) config('cue-cards.ai.model'),
                    'prompt_version' => (string) config('cue-cards.ai.prompt_version'),
                    'source_hashes' => $cards->mapWithKeys(
                        static fn (Card $card): array => [$card->id => $card->content_hash],
                    )->all(),
                    'source_cue_versions' => $cards->mapWithKeys(
                        static fn (Card $card): array => [$card->id => $card->cueSet->version],
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
        } catch (QueryException $exception) {
            $generation = $operationId === null ? null : AiGeneration::query()
                ->where('user_id', $user->id)->where('operation_id', $operationId)->first();
            if ($generation === null) {
                throw $exception;
            }
            $generation = $this->validateReplay($generation, $script, $singleCard, $replaceManual);
        }

        return $generation->refresh();
    }

    private function validateReplay(
        AiGeneration $generation,
        Script $script,
        ?Card $singleCard,
        bool $replaceManual,
    ): AiGeneration {
        if (
            $generation->script_id !== $script->id
            || $generation->card_id !== $singleCard?->id
            || $generation->replace_manual !== $replaceManual
        ) {
            throw ValidationException::withMessages([
                'operation_id' => ['Этот идентификатор уже использован для другого запроса.'],
            ]);
        }

        return $generation;
    }
}
