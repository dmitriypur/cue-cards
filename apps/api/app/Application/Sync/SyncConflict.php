<?php

namespace App\Application\Sync;

use App\Domain\Scripts\ScriptSnapshot;
use RuntimeException;

class SyncConflict extends RuntimeException
{
    public function __construct(
        public readonly string $aggregateId,
        public readonly ScriptSnapshot $local,
        public readonly ScriptSnapshot $server,
    ) {
        parent::__construct('The aggregate version changed on the server.');
    }
}
