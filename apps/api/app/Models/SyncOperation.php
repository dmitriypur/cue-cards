<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['operation_id', 'user_id', 'aggregate_id', 'type', 'command_hash', 'result_version'])]
class SyncOperation extends Model
{
    protected $primaryKey = 'operation_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['result_version' => 'integer'];
    }
}
