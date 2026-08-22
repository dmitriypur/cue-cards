<?php

namespace Tests\Integration\AiAssistance;

use App\Application\AiAssistance\CueGenerator;
use App\Domain\AiAssistance\CueGenerationRequest;
use App\Infrastructure\Ai\CueCardsAgent;
use App\Infrastructure\Ai\LaravelAiCueGenerator;
use Laravel\Ai\Prompts\AgentPrompt;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StructuredTextResponse;
use Tests\TestCase;

class LaravelAiCueGeneratorTest extends TestCase
{
    public function test_prompts_deepseek_for_structured_cues_and_maps_usage(): void
    {
        config()->set('cue-cards.ai.model', 'deepseek-test-model');
        config()->set('cue-cards.ai.max_cue_characters', 200);
        CueCardsAgent::fake([new StructuredTextResponse(
            ['cards' => [[
                'card_id' => self::CARD_ID,
                'cues' => ['Мысль один', 'Мысль два', 'Мысль три', 'Мысль четыре', 'Мысль пять', 'Мысль шесть'],
            ]]],
            '{}',
            new Usage(promptTokens: 12, completionTokens: 5),
            new Meta('deepseek', 'deepseek-test-model'),
        )]);
        $request = CueGenerationRequest::fromCards(
            [[
                'card_id' => self::CARD_ID,
                'title' => 'Синтетический блок',
                'full_text' => 'Полный синтетический текст.',
                'source_hash' => hash('sha256', 'Полный синтетический текст.'),
            ]],
            'Сценарий для связной речи',
            [
                ['card_id' => self::CARD_ID, 'position' => 0, 'title' => 'Синтетический блок'],
                ['card_id' => self::NEIGHBOUR_CARD_ID, 'position' => 1, 'title' => 'Следующий смысловой блок'],
            ],
        );

        $result = (new LaravelAiCueGenerator)->generate($request);

        $this->assertSame(12, $result->inputTokens);
        $this->assertSame(5, $result->outputTokens);
        $this->assertNotNull($result->providerRequestId);
        $this->assertCount(6, $result->forCard(self::CARD_ID)->cues);
        CueCardsAgent::assertPrompted(static fn (AgentPrompt $prompt): bool => $prompt->provider()->name() === 'deepseek'
            && $prompt->model === 'deepseek-test-model'
            && $prompt->timeout === 90
            && $prompt->contains(self::CARD_ID)
            && $prompt->contains('Сценарий для связной речи')
            && $prompt->contains('Следующий смысловой блок')
            && $prompt->contains('Полный синтетический текст.')
        );
        $this->assertInstanceOf(LaravelAiCueGenerator::class, app(CueGenerator::class));
    }

    private const CARD_ID = '0198a70e-23a2-73df-8387-34636552833a';

    private const NEIGHBOUR_CARD_ID = '0198a70e-23a2-73df-8387-34636552833b';
}
