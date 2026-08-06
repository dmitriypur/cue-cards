<?php

namespace App\Application\Auth;

use App\Models\User;

class Logout
{
    public function handle(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }
}
