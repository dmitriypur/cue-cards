<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

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

            return $response;
        } finally {
            Context::forget('correlation_id');
        }
    }
}
