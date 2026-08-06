<?php

namespace App\Application\Auth;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\NewAccessToken;

class Login
{
    private const DUMMY_PASSWORD_HASH = '$2y$12$foPX.7HiU7yQ4osX9gmpmejY2z9r3s01PyaKaAr9/GJmLWEPobzFC';

    public function handle(string $email, string $password, string $deviceName): NewAccessToken
    {
        $user = User::query()->where('email', $email)->first();
        $passwordMatches = Hash::check($password, $user?->password ?? self::DUMMY_PASSWORD_HASH);

        if (! $user || ! $passwordMatches) {
            throw new AuthenticationException('Invalid credentials.');
        }

        return $user->createToken($deviceName);
    }
}
