<?php

namespace App\Application\Sync;

final readonly class SyncBatchResult
{
    /** @param list<AppliedChange> $results */
    public function __construct(public array $results) {}
}
