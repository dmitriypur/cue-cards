<?php

namespace App\Application\Sync;

use App\Models\User;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncOperationLogger
{
    public function record(User $user, SyncCommand $command, string $outcome, ?int $resultVersion): void
    {
        Log::info('sync.operation', [
            'correlation_id' => (string) Context::get('correlation_id', (string) Str::uuid()),
            'user_id' => $user->id,
            'operation_id' => $command->operationId,
            'aggregate_id' => $command->aggregateId,
            'base_version' => $command->baseVersion,
            'result_version' => $resultVersion,
            'outcome' => $outcome,
        ]);
    }
}
