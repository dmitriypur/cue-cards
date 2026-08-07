<?php

namespace App\Application\AiAssistance;

use App\Domain\AiAssistance\GenerationStatus;
use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\CueSet;
use App\Models\Script;
use App\Models\SyncChange;
use Illuminate\Support\Facades\DB;

class FailCueGeneration
{
    public function __construct(private readonly BuildScriptSyncSnapshot $snapshots) {}

    public function handle(AiGeneration $generation): void
    {
        DB::transaction(function () use ($generation): void {
            $generation = AiGeneration::query()->lockForUpdate()->findOrFail($generation->id);
            if (in_array($generation->status, [GenerationStatus::Completed, GenerationStatus::Failed], true)) {
                return;
            }

            $script = Script::query()->lockForUpdate()->findOrFail($generation->script_id);
            $cards = Card::withTrashed()->whereIn('id', array_keys($generation->source_hashes))->get();
            foreach ($cards as $card) {
                $cueSet = CueSet::query()->where('card_id', $card->id)->lockForUpdate()->firstOrFail();
                if ($cueSet->generation_id !== $generation->id) {
                    continue;
                }
                $cueSet->update([
                    'status' => 'failed',
                    'version' => $cueSet->version + 1,
                ]);
            }

            $script->update(['version' => $script->version + 1, 'updated_at' => now()]);
            $script->refresh();
            $generation->update([
                'status' => GenerationStatus::Failed,
                'error_code' => 'AI_PROVIDER_ERROR',
                'error_message' => 'Не удалось создать тезисы. Повторите попытку.',
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
