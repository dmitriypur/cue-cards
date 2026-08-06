<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Auth\Login;
use App\Application\Auth\Logout;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(LoginRequest $request, Login $login): JsonResponse
    {
        $credentials = $request->validated();

        try {
            $token = $login->handle(
                $credentials['email'],
                $credentials['password'],
                $credentials['device_name'],
            );
        } catch (AuthenticationException) {
            return response()->json([
                'error' => [
                    'code' => 'AUTH_INVALID_CREDENTIALS',
                    'message' => 'Неверный email или пароль.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                ],
            ], Response::HTTP_UNAUTHORIZED);
        }

        return response()->json([
            'data' => [
                'access_token' => $token->plainTextToken,
                'token_type' => 'Bearer',
                'user' => (new UserResource($token->accessToken->tokenable))->resolve($request),
            ],
        ]);
    }

    public function logout(Request $request, Logout $logout): Response
    {
        $logout->handle($request->user());

        return response()->noContent();
    }
}
