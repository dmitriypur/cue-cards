<?php

use App\Http\Controllers\Api\V1\AiGenerationController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\ScriptController;
use App\Http\Controllers\Api\V1\SyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', MeController::class);
        Route::get('/scripts/{script}', [ScriptController::class, 'show']);
        Route::post('/scripts/{script}/cue-generations', [AiGenerationController::class, 'startScript'])->middleware('throttle:ai-generation');
        Route::post('/cards/{card}/cue-generations', [AiGenerationController::class, 'startCard'])->middleware('throttle:ai-generation');
        Route::get('/ai-generations/{generation}', [AiGenerationController::class, 'show'])->middleware('throttle:ai-generation-status');
        Route::post('/sync/commands', [SyncController::class, 'submit'])->middleware('throttle:sync');
        Route::get('/sync', [SyncController::class, 'changes'])->middleware('throttle:sync');
    });
});
