<?php

namespace App\Application\Sync;

use App\Domain\Scripts\ScriptSnapshot;
use App\Models\Script;
use App\Models\SyncChange;
use App\Models\SyncOperation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class ApplyScriptSnapshot
{
    public function __construct(private readonly SyncOperationLogger $logger) {}

    public function handle(User $user, SyncCommand $command): AppliedChange
    {
        try {
            $change = DB::transaction(function () use ($user, $command): AppliedChange {
                $now = now();
                $claimed = SyncOperation::query()->insertOrIgnore([
                    'operation_id' => $command->operationId,
                    'user_id' => $user->id,
                    'aggregate_id' => $command->aggregateId,
                    'type' => $command->type,
                    'command_hash' => $command->hash,
                    'result_version' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]) === 1;
                $prior = SyncOperation::query()->lockForUpdate()->find($command->operationId);
                if (! $claimed) {
                    if ($prior === null || $prior->result_version === null) {
                        throw new InvalidSyncCommand('Operation claim is incomplete.');
                    }
                    if ((int) $prior->user_id !== (int) $user->id || $prior->command_hash !== $command->hash) {
                        throw new InvalidSyncCommand('Operation ID was already used for another command.');
                    }

                    return new AppliedChange($command->operationId, $command->aggregateId, $prior->result_version, true);
                }

                $script = Script::withTrashed()->whereKey($command->aggregateId)->lockForUpdate()->first();
                if ($script !== null && (int) $script->user_id !== (int) $user->id) {
                    throw new AuthorizationException;
                }
                $currentVersion = $script?->version ?? 0;
                if ($currentVersion !== $command->baseVersion) {
                    if ($script === null) {
                        throw new InvalidSyncCommand('Missing aggregate cannot have a non-zero base version.');
                    }
                    throw new SyncConflict($command->aggregateId, $command->payload, $this->snapshot($script));
                }

                $this->guardNestedOwnership($command->payload);

                $version = $currentVersion + 1;
                $snapshot = $command->payload->toArray();
                $snapshot['version'] = $version;
                $this->persist($user, $snapshot);

                SyncOperation::query()->whereKey($command->operationId)->update([
                    'result_version' => $version,
                    'updated_at' => now(),
                ]);
                SyncChange::query()->create([
                    'user_id' => $user->id,
                    'aggregate_id' => $command->aggregateId,
                    'version' => $version,
                    'type' => $command->type,
                    'snapshot' => $snapshot,
                ]);

                return new AppliedChange($command->operationId, $command->aggregateId, $version, false);
            });
        } catch (SyncConflict $conflict) {
            $this->logger->record($user, $command, 'conflict', $conflict->server->toArray()['version']);

            throw $conflict;
        } catch (AuthorizationException $exception) {
            $this->logger->record($user, $command, 'denied', null);

            throw $exception;
        }

        $this->logger->record($user, $command, $change->duplicate ? 'duplicate' : 'applied', $change->version);

        return $change;
    }

    private function guardNestedOwnership(ScriptSnapshot $snapshot): void
    {
        $cardIds = array_column($snapshot->cards, 'id');
        if ($cardIds === []) {
            return;
        }

        $foreignCardExists = DB::table('cards')
            ->whereIn('id', $cardIds)
            ->where('script_id', '!=', $snapshot->id)
            ->exists();

        if ($foreignCardExists) {
            throw new AuthorizationException;
        }

        $cueCardIds = [];
        foreach ($snapshot->cards as $card) {
            if ($card['cue_set'] !== null) {
                $cueCardIds[$card['cue_set']['id']] = $card['id'];
            }
        }

        if ($cueCardIds === []) {
            return;
        }

        $existingCueSets = DB::table('cue_sets')->whereIn('id', array_keys($cueCardIds))->get(['id', 'card_id']);
        foreach ($existingCueSets as $cueSet) {
            if ($cueSet->card_id !== $cueCardIds[$cueSet->id]) {
                throw new AuthorizationException;
            }
        }
    }

    /** @param array<string, mixed> $snapshot */
    private function persist(User $user, array $snapshot): void
    {
        $now = now();
        $scriptValues = [
            'user_id' => $user->id, 'title' => $snapshot['title'], 'source_format' => $snapshot['source_format'],
            'source_text' => $snapshot['source_text'], 'import_hash' => $snapshot['import_hash'], 'status' => $snapshot['status'],
            'version' => $snapshot['version'], 'last_opened_at' => $snapshot['last_opened_at'], 'updated_at' => $snapshot['updated_at'],
            'deleted_at' => $snapshot['deleted_at'],
        ];
        if (! DB::table('scripts')->where('id', $snapshot['id'])->exists()) {
            DB::table('scripts')->insert(['id' => $snapshot['id'], 'created_at' => $now, ...$scriptValues]);
        } else {
            DB::table('scripts')->where('id', $snapshot['id'])->update($scriptValues);
        }

        DB::table('cards')->where('script_id', $snapshot['id'])->update(['position' => DB::raw('position + 1000000')]);
        $ids = [];
        foreach ($snapshot['cards'] as $card) {
            $ids[] = $card['id'];
            $cardValues = [
                'script_id' => $snapshot['id'], 'position' => $card['position'], 'title' => $card['title'],
                'full_text' => $card['full_text'], 'content_hash' => $card['content_hash'], 'version' => $card['version'],
                'updated_at' => $snapshot['updated_at'], 'deleted_at' => $card['deleted_at'],
            ];
            if (! DB::table('cards')->where('id', $card['id'])->exists()) {
                DB::table('cards')->insert(['id' => $card['id'], 'created_at' => $now, ...$cardValues]);
            } else {
                DB::table('cards')->where('id', $card['id'])->update($cardValues);
            }
            if ($card['cue_set'] !== null) {
                $cue = $card['cue_set'];
                $cueValues = [
                    'card_id' => $card['id'], 'cues' => json_encode($cue['cues'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                    'source_hash' => $cue['source_hash'], 'status' => $cue['status'], 'generation_id' => $cue['generation_id'],
                    'manually_edited' => $cue['manually_edited'], 'version' => $cue['version'], 'updated_at' => $snapshot['updated_at'],
                ];
                if (! DB::table('cue_sets')->where('id', $cue['id'])->exists()) {
                    DB::table('cue_sets')->insert(['id' => $cue['id'], 'created_at' => $now, ...$cueValues]);
                } else {
                    DB::table('cue_sets')->where('id', $cue['id'])->update($cueValues);
                }
            } else {
                DB::table('cue_sets')->where('card_id', $card['id'])->delete();
            }
        }
        $obsolete = DB::table('cards')->where('script_id', $snapshot['id']);
        if ($ids !== []) {
            $obsolete->whereNotIn('id', $ids);
        }
        $obsolete->delete();
    }

    private function snapshot(Script $script): ScriptSnapshot
    {
        $cards = DB::table('cards')->where('script_id', $script->id)->orderBy('position')->get()->map(function ($card): array {
            $cue = DB::table('cue_sets')->where('card_id', $card->id)->first();

            return [
                'id' => $card->id, 'script_id' => $card->script_id, 'position' => (int) $card->position,
                'title' => $card->title, 'full_text' => $card->full_text, 'content_hash' => $card->content_hash,
                'version' => (int) $card->version, 'deleted_at' => $this->date($card->deleted_at),
                'cue_set' => $cue === null ? null : [
                    'id' => $cue->id, 'card_id' => $cue->card_id, 'cues' => json_decode($cue->cues, true, flags: JSON_THROW_ON_ERROR),
                    'source_hash' => $cue->source_hash, 'status' => $cue->status, 'generation_id' => $cue->generation_id,
                    'manually_edited' => (bool) $cue->manually_edited, 'version' => (int) $cue->version,
                ],
            ];
        })->all();

        return ScriptSnapshot::fromArray([
            'id' => $script->id, 'title' => $script->title, 'source_format' => $script->source_format,
            'source_text' => $script->source_text, 'import_hash' => $script->import_hash, 'status' => $script->status,
            'version' => (int) $script->version, 'last_opened_at' => $this->date($script->last_opened_at),
            'updated_at' => $this->date($script->updated_at), 'deleted_at' => $this->date($script->deleted_at), 'cards' => $cards,
        ]);
    }

    private function date(mixed $value): ?string
    {
        return $value === null ? null : date(DATE_ATOM, strtotime((string) $value));
    }
}
