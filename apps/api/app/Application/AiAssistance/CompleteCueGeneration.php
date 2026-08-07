<?php

namespace App\Application\AiAssistance;

use App\Domain\AiAssistance\CueGenerationResult;
use App\Domain\AiAssistance\GenerationStatus;
use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\CueSet;
use App\Models\Script;
use App\Models\SyncChange;
use Illuminate\Support\Facades\DB;

class CompleteCueGeneration
{
    public function __construct(private readonly BuildScriptSyncSnapshot $snapshots) {}

    public function handle(AiGeneration $generation, CueGenerationResult $result): void
    {
        DB::transaction(function () use ($generation, $result): void {
            $generation = AiGeneration::query()->lockForUpdate()->findOrFail($generation->id);
            if ($generation->status === GenerationStatus::Completed) {
                return;
            }

            $script = Script::query()->lockForUpdate()->findOrFail($generation->script_id);
            foreach ($result->cards() as $generated) {
                $card = Card::withTrashed()->whereKey($generated->cardId)->lockForUpdate()->firstOrFail();
                $cueSet = CueSet::query()->where('card_id', $card->id)->lockForUpdate()->firstOrFail();
                if ($cueSet->generation_id !== $generation->id) {
                    continue;
                }

                $accepted = hash_equals($card->content_hash, $generated->sourceHash)
                    && ! $cueSet->manually_edited;
                $cueSet->update($accepted ? [
                    'cues' => $generated->cues,
                    'source_hash' => $generated->sourceHash,
                    'status' => 'ready',
                    'version' => $cueSet->version + 1,
                ] : [
                    'status' => 'stale',
                    'version' => $cueSet->version + 1,
                ]);
            }

            $script->update([
                'version' => $script->version + 1,
                'updated_at' => now(),
            ]);
            $script->refresh();

            $generation->update([
                'status' => GenerationStatus::Completed,
                'completed_cards' => count($result->cards()),
                'provider_request_id' => $result->providerRequestId,
                'error_code' => null,
                'error_message' => null,
                'completed_at' => now(),
            ]);

            SyncChange::query()->create([
                'user_id' => $generation->user_id,
                'aggregate_id' => $script->id,
                'version' => $script->version,
                'type' => 'script.replace',
                'snapshot' => $this->snapshots->handle($script),
            ]);
        });
    }
}
