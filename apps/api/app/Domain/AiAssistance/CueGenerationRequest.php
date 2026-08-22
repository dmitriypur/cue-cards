<?php

namespace App\Domain\AiAssistance;

use InvalidArgumentException;

final readonly class CueGenerationRequest
{
    /**
     * @param  list<array{card_id: string, title: string, full_text: string, source_hash: string}>  $cards
     * @param  list<array{card_id: string, position: int, title: string}>  $outline
     */
    private function __construct(
        public array $cards,
        public string $scriptTitle,
        public array $outline,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $cards
     * @param  list<array<string, mixed>>  $outline
     */
    public static function fromCards(
        array $cards,
        string $scriptTitle = 'Сценарий',
        array $outline = [],
    ): self {
        if ($cards === []) {
            throw new InvalidArgumentException('At least one card is required.');
        }

        $ids = [];
        $normalized = [];
        foreach ($cards as $card) {
            $id = $card['card_id'] ?? null;
            $title = $card['title'] ?? null;
            $fullText = $card['full_text'] ?? null;
            $sourceHash = $card['source_hash'] ?? null;
            if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) !== 1) {
                throw new InvalidArgumentException('Every requested card must have a valid UUID.');
            }
            if (isset($ids[$id])) {
                throw new InvalidArgumentException('Requested card IDs must be unique.');
            }
            if (! is_string($title) || ! is_string($fullText)) {
                throw new InvalidArgumentException('Every requested card must include title and full text.');
            }
            if (! is_string($sourceHash) || preg_match('/^[0-9a-f]{64}$/i', $sourceHash) !== 1) {
                throw new InvalidArgumentException('Every requested card must include a source hash.');
            }
            if (! hash_equals(strtolower($sourceHash), hash('sha256', $fullText))) {
                throw new InvalidArgumentException('A requested source hash does not match its full text.');
            }

            $ids[$id] = true;
            $normalized[] = [
                'card_id' => $id,
                'title' => $title,
                'full_text' => $fullText,
                'source_hash' => strtolower($sourceHash),
            ];
        }

        $normalizedOutline = [];
        $outlineIds = [];
        foreach ($outline as $item) {
            $id = $item['card_id'] ?? null;
            $position = $item['position'] ?? null;
            $title = $item['title'] ?? null;
            if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) !== 1) {
                throw new InvalidArgumentException('Every outline card must have a valid UUID.');
            }
            if (isset($outlineIds[$id]) || ! is_int($position) || $position < 0 || ! is_string($title)) {
                throw new InvalidArgumentException('Every outline card must have a unique ID, position, and title.');
            }
            $outlineIds[$id] = true;
            $normalizedOutline[] = [
                'card_id' => $id,
                'position' => $position,
                'title' => $title,
            ];
        }
        if ($normalizedOutline === []) {
            $normalizedOutline = array_map(
                static fn (array $card, int $position): array => [
                    'card_id' => $card['card_id'],
                    'position' => $position,
                    'title' => $card['title'],
                ],
                $normalized,
                array_keys($normalized),
            );
        }

        return new self($normalized, $scriptTitle, $normalizedOutline);
    }

    public function sourceHashFor(string $cardId): string
    {
        foreach ($this->cards as $card) {
            if ($card['card_id'] === $cardId) {
                return $card['source_hash'];
            }
        }

        throw new InvalidArgumentException('Provider returned an unknown card ID.');
    }

    /** @return list<string> */
    public function cardIds(): array
    {
        return array_column($this->cards, 'card_id');
    }
}
