<?php

namespace App\Application\AiAssistance;

use App\Models\AiGeneration;
use App\Models\Script;
use App\Models\User;

class StartScriptCueGeneration
{
    public function __construct(private readonly CreateCueGeneration $create) {}

    public function handle(User $user, Script $script): AiGeneration
    {
        $cards = $script->cards()->whereNull('deleted_at')->with('cueSet')->get();

        return $this->create->handle($user, $script, $cards);
    }
}
