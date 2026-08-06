<?php

namespace App\Http\Resources\Api\V1;

use App\Application\Identity\EntitlementService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'email' => $this->resource->email,
            'role' => $this->resource->role->value,
            'entitlements' => app(EntitlementService::class)->allFor($this->resource),
        ];
    }
}
