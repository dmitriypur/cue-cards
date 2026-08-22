<?php

namespace App\Domain\Scripts;

use DateTimeImmutable;
use Throwable;

final readonly class ScriptSnapshot
{
    private const MAX_CUE_CHARACTERS = 200;

    /**
     * @param  list<array<string, mixed>>  $cards
     * @param  array<string, mixed>  $values
     */
    private function __construct(
        public string $id,
        public array $cards,
        private array $values,
    ) {}

    /** @param array<string, mixed> $values */
    public static function fromArray(array $values): self
    {
        self::requireUuid($values['id'] ?? null, 'script id');
        self::requireString($values['title'] ?? null, 'title');
        self::requireEnum($values['source_format'] ?? null, ['markdown', 'text'], 'source format');
        self::requireString($values['source_text'] ?? null, 'source text', allowEmpty: true);
        new ContentHash(self::requireString($values['import_hash'] ?? null, 'import hash'));
        self::requireEnum($values['status'] ?? null, ['draft', 'ready', 'archived'], 'script status');
        self::requireVersion($values['version'] ?? null, 'script version');
        self::requireDate($values['updated_at'] ?? null, 'updated at');
        self::requireNullableDate($values['last_opened_at'] ?? null, 'last opened at');
        self::requireNullableDate($values['deleted_at'] ?? null, 'deleted at');

        $cards = $values['cards'] ?? null;
        if (! is_array($cards) || ! array_is_list($cards)) {
            throw new InvalidScriptSnapshot('Cards must be a list.');
        }

        $cardIds = [];
        $cueIds = [];
        $activePositions = [];
        foreach ($cards as $card) {
            if (! is_array($card)) {
                throw new InvalidScriptSnapshot('Each card must be an object.');
            }

            self::validateCard($card, $values['id'], $cardIds, $cueIds);
            if (($card['deleted_at'] ?? null) === null) {
                $activePositions[] = $card['position'];
            }
        }

        sort($activePositions);
        if ($activePositions !== range(0, count($activePositions) - 1) && $activePositions !== []) {
            throw new InvalidScriptSnapshot('Active card positions must be contiguous from zero.');
        }

        /** @var list<array<string, mixed>> $cards */
        return new self($values['id'], $cards, $values);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->values;
    }

    /**
     * @param  array<string, mixed>  $card
     * @param  array<string, true>  $cardIds
     * @param  array<string, true>  $cueIds
     */
    private static function validateCard(array $card, string $scriptId, array &$cardIds, array &$cueIds): void
    {
        $id = self::requireUuid($card['id'] ?? null, 'card id');
        if (isset($cardIds[$id])) {
            throw new InvalidScriptSnapshot('Card IDs must be unique.');
        }
        $cardIds[$id] = true;

        if (($card['script_id'] ?? null) !== $scriptId) {
            throw new InvalidScriptSnapshot('Card script ID must match the snapshot.');
        }
        if (! is_int($card['position'] ?? null) || $card['position'] < 0) {
            throw new InvalidScriptSnapshot('Card position must be non-negative.');
        }
        self::requireString($card['title'] ?? null, 'card title');
        $fullText = self::requireString($card['full_text'] ?? null, 'card full text', allowEmpty: true);
        $contentHash = new ContentHash(self::requireString($card['content_hash'] ?? null, 'content hash'));
        if (! $contentHash->matches($fullText)) {
            throw new InvalidScriptSnapshot('Card content hash does not match its full text.');
        }
        self::requireVersion($card['version'] ?? null, 'card version');
        self::requireNullableDate($card['deleted_at'] ?? null, 'card deleted at');

        $cueSet = $card['cue_set'] ?? null;
        if ($cueSet !== null) {
            if (! is_array($cueSet)) {
                throw new InvalidScriptSnapshot('Cue set must be an object.');
            }
            self::validateCueSet($cueSet, $id, $contentHash->value, $cueIds);
        }
    }

    /** @param array<string, mixed> $cueSet @param array<string, true> $cueIds */
    private static function validateCueSet(array $cueSet, string $cardId, string $contentHash, array &$cueIds): void
    {
        $id = self::requireUuid($cueSet['id'] ?? null, 'cue set id');
        if (isset($cueIds[$id])) {
            throw new InvalidScriptSnapshot('Cue set IDs must be unique.');
        }
        $cueIds[$id] = true;
        if (($cueSet['card_id'] ?? null) !== $cardId) {
            throw new InvalidScriptSnapshot('Cue set card ID must match its card.');
        }

        $status = self::requireEnum($cueSet['status'] ?? null, ['missing', 'pending', 'generating', 'ready', 'stale', 'failed'], 'cue status');
        $cues = $cueSet['cues'] ?? null;
        if (! is_array($cues) || ! array_is_list($cues)) {
            throw new InvalidScriptSnapshot('Cues must be a list of strings.');
        }
        $normalizedCues = [];
        foreach ($cues as $cue) {
            self::requireString($cue, 'cue');
            if (mb_strlen($cue) > self::MAX_CUE_CHARACTERS) {
                throw new InvalidScriptSnapshot('Cue must not exceed 200 characters.');
            }
            $normalizedCue = trim($cue);
            if (isset($normalizedCues[$normalizedCue])) {
                throw new InvalidScriptSnapshot('Cues must be unique within a card.');
            }
            $normalizedCues[$normalizedCue] = true;
        }

        $sourceHash = $cueSet['source_hash'] ?? null;
        if ($sourceHash !== null) {
            new ContentHash(self::requireString($sourceHash, 'cue source hash'));
        }
        if ($status === 'ready' && ($cues === [] || $sourceHash !== $contentHash)) {
            throw new InvalidScriptSnapshot('Ready cues require at least one entry matching the card content hash.');
        }
        $generationId = $cueSet['generation_id'] ?? null;
        if ($generationId !== null) {
            self::requireUuid($generationId, 'generation id');
        }
        if (! is_bool($cueSet['manually_edited'] ?? null)) {
            throw new InvalidScriptSnapshot('Manually edited must be boolean.');
        }
        self::requireVersion($cueSet['version'] ?? null, 'cue set version');
    }

    private static function requireUuid(mixed $value, string $field): string
    {
        if (! is_string($value) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) !== 1) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }

        return $value;
    }

    /** @param list<string> $allowed */
    private static function requireEnum(mixed $value, array $allowed, string $field): string
    {
        if (! is_string($value) || ! in_array($value, $allowed, true)) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }

        return $value;
    }

    private static function requireString(mixed $value, string $field, bool $allowEmpty = false): string
    {
        if (! is_string($value) || (! $allowEmpty && trim($value) === '')) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }

        return $value;
    }

    private static function requireVersion(mixed $value, string $field): int
    {
        if (! is_int($value) || $value < 0) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }

        return $value;
    }

    private static function requireDate(mixed $value, string $field): void
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/', $value) !== 1) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }
        try {
            new DateTimeImmutable($value);
            $errors = DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
                throw new InvalidScriptSnapshot("Invalid {$field}.");
            }
        } catch (Throwable) {
            throw new InvalidScriptSnapshot("Invalid {$field}.");
        }
    }

    private static function requireNullableDate(mixed $value, string $field): void
    {
        if ($value !== null) {
            self::requireDate($value, $field);
        }
    }
}
