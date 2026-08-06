<?php

namespace App\Policies;

use App\Models\Script;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ScriptPolicy
{
    public function view(User $user, Script $script): Response
    {
        return $script->user_id === $user->id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
