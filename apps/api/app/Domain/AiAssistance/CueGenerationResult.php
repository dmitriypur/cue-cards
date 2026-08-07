<?php

namespace App\Domain\AiAssistance;

use InvalidArgumentException;

final readonly class CueGenerationResult
{
    /** @param array<string, GeneratedCardCues> $cards */
    private function __construct(
        private array $cards,
        public ?string $providerRequestId,
        public int $inputTokens,
        public int $outputTokens,
    ) {}

    /** @param array<string, mixed> $response */
    public static function fromProviderResponse(
        CueGenerationRequest $request,
        array $response,
        int $maxCueCharacters,
        ?string $providerRequestId = null,
        int $inputTokens = 0,
        int $outputTokens = 0,
    ): self {
        $cards = $response['cards'] ?? null;
        if (! is_array($cards) || ! array_is_list($cards)) {
            throw new InvalidArgumentException('Provider cards must be a list.');
        }

        $expectedIds = array_fill_keys($request->cardIds(), true);
        $normalized = [];
        foreach ($cards as $card) {
            if (! is_array($card)) {
                throw new InvalidArgumentException('Every provider card must be an object.');
            }
            $cardId = $card['card_id'] ?? null;
            if (! is_string($cardId) || ! isset($expectedIds[$cardId])) {
                throw new InvalidArgumentException('Provider returned an unknown card ID.');
            }
            if (isset($normalized[$cardId])) {
                throw new InvalidArgumentException('Provider returned a card more than once.');
            }

            $cues = $card['cues'] ?? null;
            if (! is_array($cues) || ! array_is_list($cues) || count($cues) < 3 || count($cues) > 5) {
                throw new InvalidArgumentException('Every card must contain 3–5 cues.');
            }
            $trimmed = [];
            foreach ($cues as $cue) {
                if (! is_string($cue) || trim($cue) === '') {
                    throw new InvalidArgumentException('Cues must be non-empty strings.');
                }
                $cue = trim($cue);
                if (mb_strlen($cue) > $maxCueCharacters) {
                    throw new InvalidArgumentException('A cue exceeds the configured length.');
                }
                if (in_array($cue, $trimmed, true)) {
                    throw new InvalidArgumentException('Cues must be unique within a card.');
                }
                $trimmed[] = $cue;
            }

            $normalized[$cardId] = new GeneratedCardCues(
                $cardId,
                $request->sourceHashFor($cardId),
                $trimmed,
            );
        }

        if (count($normalized) !== count($expectedIds)) {
            throw new InvalidArgumentException('Provider must return every requested card exactly once.');
        }
        if ($inputTokens < 0 || $outputTokens < 0) {
            throw new InvalidArgumentException('Token counts must not be negative.');
        }

        $ordered = [];
        foreach ($request->cardIds() as $cardId) {
            $ordered[$cardId] = $normalized[$cardId];
        }

        return new self($ordered, $providerRequestId, $inputTokens, $outputTokens);
    }

    public function forCard(string $cardId): GeneratedCardCues
    {
        return $this->cards[$cardId] ?? throw new InvalidArgumentException('No result exists for the requested card.');
    }

    /** @return list<GeneratedCardCues> */
    public function cards(): array
    {
        return array_values($this->cards);
    }
}
