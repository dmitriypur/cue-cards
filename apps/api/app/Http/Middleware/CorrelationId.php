<?php

namespace App\Http\Middleware;

use App\Support\SafeContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CorrelationId
{
    public function handle(Request $request, Closure $next): Response
    {
        $candidate = $request->header('X-Correlation-ID');
        $correlationId = is_string($candidate) && Str::isUuid($candidate)
            ? $candidate
            : (string) Str::uuid();

        $request->headers->set('X-Correlation-ID', $correlationId);
        Context::add('correlation_id', $correlationId);

        try {
            $response = $next($request);
            $response->headers->set('X-Correlation-ID', $correlationId);
            Log::info('api.request', SafeContext::fromRequest(
                $request,
                outcome: 'http_'.$response->getStatusCode(),
            ));

            return $response;
        } catch (Throwable $exception) {
            Log::info('api.request', SafeContext::fromRequest(
                $request,
                outcome: 'exception_'.class_basename($exception),
            ));
            throw $exception;
        } finally {
            Context::forget('correlation_id');
        }
    }
}
