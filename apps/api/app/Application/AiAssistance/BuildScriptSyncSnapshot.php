<?php

namespace App\Application\AiAssistance;

use App\Models\Script;
use Illuminate\Support\Facades\DB;

class BuildScriptSyncSnapshot
{
    /** @return array<string, mixed> */
    public function handle(Script $script): array
    {
        $cards = DB::table('cards')->where('script_id', $script->id)->orderBy('position')->get()->map(function ($card): array {
            $cue = DB::table('cue_sets')->where('card_id', $card->id)->first();

            return [
                'id' => $card->id,
                'script_id' => $card->script_id,
                'position' => (int) $card->position,
                'title' => $card->title,
                'full_text' => $card->full_text,
                'content_hash' => $card->content_hash,
                'version' => (int) $card->version,
                'deleted_at' => $this->date($card->deleted_at),
                'cue_set' => $cue === null ? null : [
                    'id' => $cue->id,
                    'card_id' => $cue->card_id,
                    'cues' => json_decode($cue->cues, true, flags: JSON_THROW_ON_ERROR),
                    'source_hash' => $cue->source_hash,
                    'status' => $cue->status,
                    'generation_id' => $cue->generation_id,
                    'manually_edited' => (bool) $cue->manually_edited,
                    'version' => (int) $cue->version,
                ],
            ];
        })->all();

        return [
            'id' => $script->id,
            'title' => $script->title,
            'source_format' => $script->source_format,
            'source_text' => $script->source_text,
            'import_hash' => $script->import_hash,
            'status' => $script->status,
            'version' => (int) $script->version,
            'last_opened_at' => $this->date($script->last_opened_at),
            'updated_at' => $this->date($script->updated_at),
            'deleted_at' => $this->date($script->deleted_at),
            'cards' => $cards,
        ];
    }

    private function date(mixed $value): ?string
    {
        return $value === null ? null : date(DATE_ATOM, strtotime((string) $value));
    }
}
