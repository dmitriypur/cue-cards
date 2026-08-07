<?php

namespace App\Application\AiAssistance;

use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\User;

class StartCardCueGeneration
{
    public function __construct(private readonly CreateCueGeneration $create) {}

    public function handle(
        User $user,
        Card $card,
        bool $replaceManual = false,
        ?string $operationId = null,
    ): AiGeneration {
        $card->loadMissing(['script', 'cueSet']);

        return $this->create->handle(
            $user,
            $card->script,
            collect([$card]),
            $card,
            $replaceManual,
            $operationId,
        );
    }
}
