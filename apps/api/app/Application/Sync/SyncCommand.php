<?php

namespace App\Application\Sync;

use App\Domain\Scripts\ScriptSnapshot;
use DateTimeImmutable;
use Throwable;

final readonly class SyncCommand
{
    private function __construct(
        public string $operationId,
        public string $aggregateId,
        public string $type,
        public int $baseVersion,
        public ScriptSnapshot $payload,
        public string $createdAt,
        public string $hash,
    ) {}

    /** @param array<string, mixed> $values */
    public static function fromArray(array $values): self
    {
        foreach (['operation_id', 'aggregate_id'] as $key) {
            if (! is_string($values[$key] ?? null) || preg_match('/^[0-9a-f-]{36}$/i', $values[$key]) !== 1) {
                throw new InvalidSyncCommand("Invalid {$key}.");
            }
        }
        if (($values['type'] ?? null) !== 'script.replace') {
            throw new InvalidSyncCommand('Unsupported sync command type.');
        }
        if (! is_int($values['base_version'] ?? null) || $values['base_version'] < 0) {
            throw new InvalidSyncCommand('Invalid base version.');
        }
        if (! is_array($values['payload'] ?? null)) {
            throw new InvalidSyncCommand('Invalid command payload.');
        }
        $payload = ScriptSnapshot::fromArray($values['payload']);
        if ($payload->id !== $values['aggregate_id']) {
            throw new InvalidSyncCommand('Aggregate ID must match payload ID.');
        }
        if (! is_string($values['created_at'] ?? null)
            || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/', $values['created_at']) !== 1) {
            throw new InvalidSyncCommand('Invalid command timestamp.');
        }
        try {
            new DateTimeImmutable($values['created_at']);
            $errors = DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
                throw new InvalidSyncCommand('Invalid command timestamp.');
            }
        } catch (Throwable) {
            throw new InvalidSyncCommand('Invalid command timestamp.');
        }

        $encoded = json_encode($values, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return new self(
            $values['operation_id'], $values['aggregate_id'], $values['type'],
            $values['base_version'], $payload, $values['created_at'], hash('sha256', $encoded),
        );
    }
}
