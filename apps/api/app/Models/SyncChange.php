<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'aggregate_id', 'version', 'type', 'snapshot'])]
class SyncChange extends Model
{
    protected $primaryKey = 'cursor';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['version' => 'integer', 'snapshot' => 'array'];
    }
}
