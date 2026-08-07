<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\AiAssistance\GenerationStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AiGenerationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'script_id' => $this->resource->script_id,
            'card_id' => $this->resource->card_id,
            'status' => $this->resource->status->value,
            'completed_cards' => $this->resource->completed_cards,
            'total_cards' => $this->resource->total_cards,
            'error' => $this->resource->status === GenerationStatus::Failed ? [
                'code' => $this->resource->error_code,
                'message' => $this->resource->error_message,
                'correlation_id' => $request->header('X-Correlation-ID'),
            ] : null,
            'created_at' => $this->resource->created_at?->toAtomString(),
            'updated_at' => $this->resource->updated_at?->toAtomString(),
        ];
    }
}
