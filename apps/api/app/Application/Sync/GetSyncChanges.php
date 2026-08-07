<?php

namespace App\Application\Sync;

use App\Models\SyncChange;
use App\Models\User;

class GetSyncChanges
{
    public function handle(User $user, int $afterCursor, int $limit): SyncPage
    {
        $rows = SyncChange::query()->where('user_id', $user->id)->where('cursor', '>', $afterCursor)
            ->orderBy('cursor')->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $changes = $rows->take($limit)->values()->all();
        $next = $changes === [] ? $afterCursor : (int) end($changes)->cursor;

        return new SyncPage($changes, $next, $hasMore);
    }
}
