<?php

namespace App\Application\Scripts;

use App\Models\Script;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class GetScript
{
    public function handle(User $user, Script $script): Script
    {
        Gate::forUser($user)->authorize('view', $script);

        return $script->load(['cards.cueSet']);
    }
}
