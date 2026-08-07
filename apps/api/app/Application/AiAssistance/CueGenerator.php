<?php

namespace App\Application\AiAssistance;

use App\Domain\AiAssistance\CueGenerationRequest;
use App\Domain\AiAssistance\CueGenerationResult;

interface CueGenerator
{
    public function generate(CueGenerationRequest $request): CueGenerationResult;
}
