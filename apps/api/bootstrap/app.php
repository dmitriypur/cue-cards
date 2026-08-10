<?php

use App\Application\AiAssistance\FeatureNotAvailable;
use App\Application\AiAssistance\ManualCueReplacementRequired;
use App\Application\Sync\InvalidSyncCommand;
use App\Application\Sync\SyncConflict;
use App\Domain\Scripts\InvalidScriptSnapshot;
use App\Http\Middleware\CorrelationId;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [CorrelationId::class]);
        $middleware->redirectGuestsTo(
            static fn (Request $request): ?string => $request->is('api/*') ? null : '/',
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $invalidSyncPayload = static function (Request $request): JsonResponse {
            return response()->json(['error' => [
                'code' => 'VALIDATION_FAILED',
                'message' => 'Проверьте данные синхронизации.',
                'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                'fields' => ['commands' => ['Snapshot is invalid.']],
            ]], 422);
        };
        $exceptions->render(function (InvalidScriptSnapshot $exception, Request $request) use ($invalidSyncPayload): JsonResponse {
            return $invalidSyncPayload($request);
        });
        $exceptions->render(function (InvalidSyncCommand $exception, Request $request) use ($invalidSyncPayload): JsonResponse {
            return $invalidSyncPayload($request);
        });
        $exceptions->render(function (SyncConflict $exception, Request $request): JsonResponse {
            return response()->json(['error' => [
                'code' => 'SYNC_VERSION_CONFLICT', 'message' => 'Сценарий изменён на сервере.',
                'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                'conflict' => ['aggregate_id' => $exception->aggregateId, 'local' => $exception->local->toArray(), 'server' => $exception->server->toArray()],
            ]], 409);
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->render(function (AuthenticationException $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'AUTH_UNAUTHENTICATED',
                    'message' => 'Требуется вход в аккаунт.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                ],
            ], 401);
        });

        $exceptions->render(function (ValidationException $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_FAILED',
                    'message' => 'Проверьте введённые данные.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                    'fields' => $exception->errors(),
                ],
            ], 422);
        });

        $notFound = static function (Request $request): JsonResponse {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'Ресурс не найден.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                ],
            ], 404);
        };

        $exceptions->render(function (AuthorizationException $exception, Request $request) use ($notFound): ?JsonResponse {
            return $request->is('api/*') ? $notFound($request) : null;
        });

        $exceptions->render(function (FeatureNotAvailable $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(['error' => [
                'code' => 'FEATURE_NOT_AVAILABLE',
                'message' => 'Функция недоступна для этого аккаунта.',
                'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
            ]], 403);
        });

        $exceptions->render(function (ManualCueReplacementRequired $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(['error' => [
                'code' => 'AI_MANUAL_CUES_CONFIRMATION_REQUIRED',
                'message' => 'Подтвердите замену ручных тезисов.',
                'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
            ]], 409);
        });

        $exceptions->render(function (ModelNotFoundException $exception, Request $request) use ($notFound): ?JsonResponse {
            return $request->is('api/*') ? $notFound($request) : null;
        });

        $exceptions->render(function (NotFoundHttpException $exception, Request $request) use ($notFound): ?JsonResponse {
            return $request->is('api/*') ? $notFound($request) : null;
        });

        $exceptions->render(function (HttpException $exception, Request $request) use ($notFound): ?JsonResponse {
            if (! $request->is('api/*') || $exception->getStatusCode() !== 404) {
                return null;
            }

            return $notFound($request);
        });

        $exceptions->render(function (HttpExceptionInterface $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $exception->getStatusCode();
            $code = match ($status) {
                403 => 'FORBIDDEN',
                405 => 'METHOD_NOT_ALLOWED',
                429 => 'RATE_LIMITED',
                default => 'HTTP_ERROR',
            };

            return response()->json([
                'error' => [
                    'code' => $code,
                    'message' => 'Запрос не может быть выполнен.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                ],
            ], $status);
        });

        $exceptions->render(function (Throwable $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Внутренняя ошибка сервера.',
                    'correlation_id' => $request->header('X-Correlation-ID', (string) Str::uuid()),
                ],
            ], 500);
        });
    })->create();
