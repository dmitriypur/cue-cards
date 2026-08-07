<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Sync\GetSyncChanges;
use App\Application\Sync\SubmitSyncCommands;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SubmitSyncCommandsRequest;
use App\Http\Resources\Api\V1\SyncChangeResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function submit(SubmitSyncCommandsRequest $request, SubmitSyncCommands $action): JsonResponse
    {
        $result = $action->handle($request->user(), $request->validated('commands'));

        return response()->json(['data' => ['results' => array_map(static fn ($item) => [
            'operation_id' => $item->operationId, 'aggregate_id' => $item->aggregateId,
            'version' => $item->version, 'duplicate' => $item->duplicate,
        ], $result->results)]]);
    }

    public function changes(Request $request, GetSyncChanges $action): JsonResponse
    {
        $data = $request->validate(['after' => ['sometimes', 'integer', 'min:0'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $page = $action->handle($request->user(), (int) ($data['after'] ?? 0), (int) ($data['limit'] ?? 50));

        return response()->json(['data' => ['changes' => SyncChangeResource::collection($page->changes)->resolve($request), 'next_cursor' => $page->nextCursor, 'has_more' => $page->hasMore]]);
    }
}
