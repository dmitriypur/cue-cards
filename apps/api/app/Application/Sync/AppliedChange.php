<?php

namespace App\Application\Sync;

final readonly class AppliedChange
{
    public function __construct(
        public string $operationId,
        public string $aggregateId,
        public int $version,
        public bool $duplicate,
    ) {}
}
