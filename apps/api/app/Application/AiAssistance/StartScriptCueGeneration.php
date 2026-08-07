<?php

namespace App\Application\AiAssistance;

use App\Models\AiGeneration;
use App\Models\Script;
use App\Models\User;

class StartScriptCueGeneration
{
    public function __construct(private readonly CreateCueGeneration $create) {}

    public function handle(User $user, Script $script, ?string $operationId = null): AiGeneration
    {
        $cards = $script->cards()
            ->whereNull('deleted_at')
            ->whereHas('cueSet', fn ($query) => $query->where('manually_edited', false))
            ->with('cueSet')
            ->get();

        return $this->create->handle($user, $script, $cards, operationId: $operationId);
    }
}
