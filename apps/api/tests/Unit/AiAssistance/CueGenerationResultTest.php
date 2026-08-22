<?php

namespace Tests\Unit\AiAssistance;

use App\Domain\AiAssistance\CueGenerationRequest;
use App\Domain\AiAssistance\CueGenerationResult;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CueGenerationResultTest extends TestCase
{
    public function test_accepts_one_and_more_than_five_cues_while_preserving_card_order(): void
    {
        $request = CueGenerationRequest::fromCards($this->requestCards());

        $result = CueGenerationResult::fromProviderResponse($request, [
            'cards' => [
                ['card_id' => self::FIRST_CARD, 'cues' => [' Единственная опорная мысль ']],
                ['card_id' => self::SECOND_CARD, 'cues' => [
                    'Первая мысль', 'Вторая мысль', 'Третья мысль',
                    'Четвёртая мысль', 'Пятая мысль', 'Шестая мысль',
                ]],
            ],
        ], 200, 'provider-request-1', 120, 45);

        $this->assertSame(['Единственная опорная мысль'], $result->forCard(self::FIRST_CARD)->cues);
        $this->assertCount(6, $result->forCard(self::SECOND_CARD)->cues);
        $this->assertSame(hash('sha256', 'Первый блок.'), $result->forCard(self::FIRST_CARD)->sourceHash);
        $this->assertSame('provider-request-1', $result->providerRequestId);
        $this->assertSame(120, $result->inputTokens);
        $this->assertSame(45, $result->outputTokens);
    }

    /** @param callable(array<string, mixed>): void $mutate */
    #[DataProvider('invalidResponses')]
    public function test_rejects_invalid_provider_results(callable $mutate): void
    {
        $request = CueGenerationRequest::fromCards($this->requestCards());
        $response = $this->validResponse();
        $mutate($response);

        $this->expectException(InvalidArgumentException::class);
        CueGenerationResult::fromProviderResponse($request, $response, 20);
    }

    public function test_requires_a_source_hash_for_every_requested_card(): void
    {
        $cards = $this->requestCards();
        unset($cards[0]['source_hash']);

        $this->expectException(InvalidArgumentException::class);
        CueGenerationRequest::fromCards($cards);
    }

    public function test_accepts_provider_cards_in_any_order_and_exposes_request_order(): void
    {
        $request = CueGenerationRequest::fromCards($this->requestCards());
        $response = $this->validResponse();
        $response['cards'] = array_reverse($response['cards']);

        $result = CueGenerationResult::fromProviderResponse($request, $response, 200);

        $this->assertSame(
            [self::FIRST_CARD, self::SECOND_CARD],
            array_map(static fn ($card): string => $card->cardId, $result->cards()),
        );
    }

    /** @return iterable<string, array{callable(array<string, mixed>): void}> */
    public static function invalidResponses(): iterable
    {
        yield 'missing expected card' => [static fn (array &$response) => array_pop($response['cards'])];
        yield 'unknown card' => [static fn (array &$response) => $response['cards'][0]['card_id'] = '0198a70e-23a2-73df-8387-34636552839f'];
        yield 'duplicate card' => [static fn (array &$response) => $response['cards'][1]['card_id'] = self::FIRST_CARD];
        yield 'empty cue list' => [static fn (array &$response) => $response['cards'][0]['cues'] = []];
        yield 'blank cue' => [static fn (array &$response) => $response['cards'][0]['cues'][1] = '   '];
        yield 'duplicate normalized cue' => [static fn (array &$response) => $response['cards'][0]['cues'] = ['Один', ' Один ', 'Три']];
        yield 'overlong cue' => [static fn (array &$response) => $response['cards'][0]['cues'][1] = str_repeat('я', 21)];
    }

    /** @return list<array{card_id: string, title: string, full_text: string, source_hash: string}> */
    private function requestCards(): array
    {
        return [
            ['card_id' => self::FIRST_CARD, 'title' => 'Первый', 'full_text' => 'Первый блок.', 'source_hash' => hash('sha256', 'Первый блок.')],
            ['card_id' => self::SECOND_CARD, 'title' => 'Второй', 'full_text' => 'Второй блок.', 'source_hash' => hash('sha256', 'Второй блок.')],
        ];
    }

    /** @return array{cards: list<array{card_id: string, cues: list<string>}>} */
    private function validResponse(): array
    {
        return ['cards' => [
            ['card_id' => self::FIRST_CARD, 'cues' => ['Один', 'Два', 'Три']],
            ['card_id' => self::SECOND_CARD, 'cues' => ['Четыре', 'Пять', 'Шесть']],
        ]];
    }

    private const FIRST_CARD = '0198a70e-23a2-73df-8387-34636552833a';

    private const SECOND_CARD = '0198a70e-23a2-73df-8387-34636552833b';
}
