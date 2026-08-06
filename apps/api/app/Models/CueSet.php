<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'id', 'card_id', 'cues', 'source_hash', 'status', 'generation_id',
    'manually_edited', 'version',
])]
class CueSet extends Model
{
    use HasUuids;

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'cues' => 'array',
            'manually_edited' => 'boolean',
            'version' => 'integer',
        ];
    }
}
