<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['id', 'script_id', 'position', 'title', 'full_text', 'content_hash', 'version'])]
class Card extends Model
{
    use HasUuids, SoftDeletes;

    /** @return BelongsTo<Script, $this> */
    public function script(): BelongsTo
    {
        return $this->belongsTo(Script::class);
    }

    /** @return HasOne<CueSet, $this> */
    public function cueSet(): HasOne
    {
        return $this->hasOne(CueSet::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'version' => 'integer',
        ];
    }
}
