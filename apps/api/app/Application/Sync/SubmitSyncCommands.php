<?php

namespace App\Application\Sync;

use App\Models\User;

class SubmitSyncCommands
{
    public function __construct(private readonly ApplyScriptSnapshot $applyScriptSnapshot) {}

    /** @param list<array<string, mixed>> $commands */
    public function handle(User $user, array $commands): SyncBatchResult
    {
        $results = [];
        foreach ($commands as $values) {
            $results[] = $this->applyScriptSnapshot->handle($user, SyncCommand::fromArray($values));
        }

        return new SyncBatchResult($results);
    }
}
