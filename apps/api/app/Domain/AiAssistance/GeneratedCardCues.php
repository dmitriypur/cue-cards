<?php

namespace App\Domain\AiAssistance;

final readonly class GeneratedCardCues
{
    /** @param list<string> $cues */
    public function __construct(
        public string $cardId,
        public string $sourceHash,
        public array $cues,
    ) {}
}
