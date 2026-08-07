<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SyncChangeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return ['cursor' => $this->cursor, 'aggregate_id' => $this->aggregate_id, 'version' => $this->version, 'type' => $this->type, 'snapshot' => $this->snapshot];
    }
}
