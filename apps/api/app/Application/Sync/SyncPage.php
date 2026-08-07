<?php

namespace App\Application\Sync;

use App\Models\SyncChange;

final readonly class SyncPage
{
    /** @param list<SyncChange> $changes */
    public function __construct(public array $changes, public int $nextCursor, public bool $hasMore) {}
}
