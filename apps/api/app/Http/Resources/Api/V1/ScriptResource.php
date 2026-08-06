<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Card;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScriptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'title' => $this->resource->title,
            'source_format' => $this->resource->source_format,
            'source_text' => $this->resource->source_text,
            'import_hash' => $this->resource->import_hash,
            'status' => $this->resource->status,
            'version' => $this->resource->version,
            'last_opened_at' => $this->resource->last_opened_at,
            'updated_at' => $this->resource->updated_at,
            'cards' => $this->resource->cards->map(
                static fn (Card $card): array => [
                    'id' => $card->id,
                    'position' => $card->position,
                    'title' => $card->title,
                    'full_text' => $card->full_text,
                    'content_hash' => $card->content_hash,
                    'version' => $card->version,
                    'cue_set' => $card->cueSet ? [
                        'id' => $card->cueSet->id,
                        'cues' => $card->cueSet->cues,
                        'source_hash' => $card->cueSet->source_hash,
                        'status' => $card->cueSet->status,
                        'generation_id' => $card->cueSet->generation_id,
                        'manually_edited' => $card->cueSet->manually_edited,
                        'version' => $card->cueSet->version,
                    ] : null,
                ],
            )->values(),
        ];
    }
}
