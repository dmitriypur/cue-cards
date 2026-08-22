<?php

namespace App\Infrastructure\Ai;

use App\Application\AiAssistance\CueGenerator;
use App\Domain\AiAssistance\CueGenerationRequest;
use App\Domain\AiAssistance\CueGenerationResult;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Responses\StructuredAgentResponse;
use RuntimeException;

class LaravelAiCueGenerator implements CueGenerator
{
    public function generate(CueGenerationRequest $request): CueGenerationResult
    {
        $prompt = json_encode([
            'task' => implode(' ', [
                'Сначала мысленно выдели все самостоятельные мысли в полном тексте каждой карточки.',
                'Верни по одному короткому законченному тезису на каждую мысль в исходном порядке.',
                'Не стремись к заданному количеству и не дроби одну мысль искусственно.',
            ]),
            'script_title' => $request->scriptTitle,
            'outline' => $request->outline,
            'cards' => array_map(static fn (array $card): array => [
                'card_id' => $card['card_id'],
                'title' => $card['title'],
                'full_text' => $card['full_text'],
            ], $request->cards),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $response = (new CueCardsAgent)->prompt(
            $prompt,
            provider: Lab::DeepSeek,
            model: (string) config('cue-cards.ai.model'),
            timeout: 90,
        );
        if (! $response instanceof StructuredAgentResponse) {
            throw new RuntimeException('AI provider did not return structured output.');
        }

        return CueGenerationResult::fromProviderResponse(
            $request,
            $response->toArray(),
            (int) config('cue-cards.ai.max_cue_characters'),
            $response->invocationId,
            $response->usage->promptTokens,
            $response->usage->completionTokens,
        );
    }
}
