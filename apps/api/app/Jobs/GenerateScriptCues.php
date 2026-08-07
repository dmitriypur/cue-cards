<?php

namespace App\Jobs;

use App\Application\AiAssistance\CompleteCueGeneration;
use App\Application\AiAssistance\CueGenerator;
use App\Application\AiAssistance\FailCueGeneration;
use App\Application\Usage\RecordAiUsage;
use App\Domain\AiAssistance\CueGenerationRequest;
use App\Domain\AiAssistance\CueGenerationResult;
use App\Domain\AiAssistance\GenerationStatus;
use App\Models\AiGeneration;
use App\Models\Card;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use InvalidArgumentException;
use Throwable;

class GenerateScriptCues implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $generationId) {}

    public function handle(
        CueGenerator $generator,
        CompleteCueGeneration $complete,
        RecordAiUsage $usage,
    ): void {
        $generation = AiGeneration::query()->findOrFail($this->generationId);
        if ($generation->status === GenerationStatus::Completed) {
            return;
        }

        $generation->update([
            'status' => GenerationStatus::Running,
            'attempts' => $generation->attempts + 1,
            'started_at' => $generation->started_at ?? now(),
            'error_code' => null,
            'error_message' => null,
        ]);
        Card::query()->whereIn('id', array_keys($generation->source_hashes))
            ->each(function (Card $card) use ($generation): void {
                $card->cueSet()->where('generation_id', $generation->id)->update(['status' => 'generating']);
            });

        $cards = Card::query()->whereIn('id', array_keys($generation->source_hashes))
            ->orderBy('position')->get();
        $requestCards = $cards->map(fn (Card $card): array => [
            'card_id' => $card->id,
            'title' => $card->title,
            'full_text' => $card->full_text,
            'source_hash' => $generation->source_hashes[$card->id],
        ])->all();
        $fullRequest = CueGenerationRequest::fromCards($requestCards);

        $responses = [];
        $inputTokens = 0;
        $outputTokens = 0;
        $providerRequestId = null;
        foreach ($this->batches($requestCards) as $batch) {
            try {
                $result = $generator->generate(CueGenerationRequest::fromCards($batch));
            } catch (Throwable $exception) {
                $usage->failed($generation);

                throw $exception;
            }
            $usage->handle($generation, $result);
            foreach ($result->cards() as $card) {
                $responses[] = ['card_id' => $card->cardId, 'cues' => $card->cues];
            }
            $inputTokens += $result->inputTokens;
            $outputTokens += $result->outputTokens;
            $providerRequestId = $result->providerRequestId;
        }

        $complete->handle($generation, CueGenerationResult::fromProviderResponse(
            $fullRequest,
            ['cards' => $responses],
            (int) config('cue-cards.ai.max_cue_characters'),
            $providerRequestId,
            $inputTokens,
            $outputTokens,
        ));
    }

    public function failed(?Throwable $exception): void
    {
        $generation = AiGeneration::query()->find($this->generationId);
        if ($generation === null || $generation->status === GenerationStatus::Completed) {
            return;
        }

        app(FailCueGeneration::class)->handle($generation);
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 15, 30];
    }

    /**
     * @param  list<array<string, mixed>>  $cards
     * @return list<list<array<string, mixed>>>
     */
    private function batches(array $cards): array
    {
        $maximum = (int) config('cue-cards.ai.max_prompt_bytes');
        $batches = [];
        $current = [];
        foreach ($cards as $card) {
            $candidate = [...$current, $card];
            $bytes = strlen(json_encode(['cards' => $candidate], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
            if ($current === [] && $bytes > $maximum) {
                throw new InvalidArgumentException('A card exceeds the configured AI prompt byte limit.');
            }
            if ($current !== [] && $bytes > $maximum) {
                $batches[] = $current;
                $current = [$card];
            } else {
                $current = $candidate;
            }
        }
        if ($current !== []) {
            $batches[] = $current;
        }

        return $batches;
    }
}
