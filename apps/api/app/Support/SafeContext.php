<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class SafeContext
{
    /** @return array<string, int|string> */
    public static function fromRequest(Request $request, ?string $outcome = null): array
    {
        $context = [
            'correlation_id' => self::uuid($request->header('X-Correlation-ID')),
            'user_id' => $request->user()?->getAuthIdentifier(),
            'operation_id' => self::uuid($request->input('operation_id')),
            'generation_id' => self::uuid($request->input('generation_id')),
            'route' => $request->route()?->uri(),
            'outcome' => $outcome,
        ];

        return array_filter(
            $context,
            static fn (mixed $value): bool => is_int($value) || (is_string($value) && $value !== ''),
        );
    }

    private static function uuid(mixed $value): ?string
    {
        return is_string($value) && Str::isUuid($value) ? $value : null;
    }
}
