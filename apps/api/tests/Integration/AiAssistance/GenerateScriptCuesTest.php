<?php

namespace Tests\Integration\AiAssistance;

use App\Application\AiAssistance\CueGenerator;
use App\Application\AiAssistance\StartScriptCueGeneration;
use App\Domain\AiAssistance\CueGenerationRequest;
use App\Domain\AiAssistance\CueGenerationResult;
use App\Domain\Identity\Role;
use App\Jobs\GenerateScriptCues;
use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\CueSet;
use App\Models\Script;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class GenerateScriptCuesTest extends TestCase
{
    use RefreshDatabase;

    public function test_success_applies_valid_cues_once_without_replacing_full_text_and_records_usage(): void
    {
        [$generation, $script, $cards] = $this->queuedGeneration();
        $originalTexts = array_map(static fn (Card $card): string => $card->full_text, $cards);
        $generator = new RecordingCueGenerator;

        $this->runJob($generation->id, $generator);

        $generation->refresh();
        $this->assertSame('completed', $generation->status->value);
        $this->assertSame(2, $generation->completed_cards);
        $this->assertSame(10, $generation->input_tokens);
        $this->assertSame(4, $generation->output_tokens);
        $this->assertSame(1, $generation->provider_calls);
        $this->assertSame(0, $generation->failed_provider_calls);
        $this->assertSame(1, $generation->attempts);
        $this->assertSame(2, $script->refresh()->version);
        $this->assertDatabaseCount('sync_changes', 1);

        foreach ($cards as $index => $card) {
            $this->assertSame($originalTexts[$index], $card->refresh()->full_text);
            $this->assertSame('ready', $card->cueSet->status);
            $this->assertCount(3, $card->cueSet->cues);
            $this->assertSame($card->content_hash, $card->cueSet->source_hash);
        }
    }

    public function test_batches_cards_deterministically_by_configured_prompt_bytes(): void
    {
        config()->set('cue-cards.ai.max_prompt_bytes', 230);
        [$generation, , $cards] = $this->queuedGeneration();
        $generator = new RecordingCueGenerator;

        $this->runJob($generation->id, $generator);

        $this->assertSame([
            [$cards[0]->id],
            [$cards[1]->id],
        ], $generator->requestedCardIds);
        $this->assertSame(20, $generation->refresh()->input_tokens);
        $this->assertSame(2, $generation->provider_calls);
    }

    public function test_content_changed_while_provider_runs_preserves_text_and_marks_cues_stale(): void
    {
        [$generation, , $cards] = $this->queuedGeneration();
        $generator = new RecordingCueGenerator(function () use ($cards): void {
            $cards[0]->update([
                'full_text' => 'Локально изменённый полный текст.',
                'content_hash' => hash('sha256', 'Локально изменённый полный текст.'),
            ]);
        });

        $this->runJob($generation->id, $generator);

        $this->assertSame('Локально изменённый полный текст.', $cards[0]->refresh()->full_text);
        $this->assertSame('stale', $cards[0]->cueSet->status);
        $this->assertSame([], $cards[0]->cueSet->cues);
        $this->assertSame('ready', $cards[1]->refresh()->cueSet->status);
    }

    public function test_manual_cues_written_while_provider_runs_are_never_replaced(): void
    {
        [$generation, , $cards] = $this->queuedGeneration();
        $manual = ['Ручной один', 'Ручной два', 'Ручной три'];
        $generator = new RecordingCueGenerator(function () use ($cards, $manual): void {
            $cards[0]->cueSet()->update([
                'cues' => json_encode($manual, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'manually_edited' => true,
                'status' => 'ready',
                'source_hash' => $cards[0]->content_hash,
            ]);
        });

        $this->runJob($generation->id, $generator);

        $cueSet = $cards[0]->refresh()->cueSet;
        $this->assertSame($manual, $cueSet->cues);
        $this->assertTrue($cueSet->manually_edited);
        $this->assertSame('stale', $cueSet->status);
    }

    public function test_three_failed_attempts_end_safely_without_leaking_provider_exception(): void
    {
        [$generation, , $cards] = $this->queuedGeneration();
        $sentinel = 'СЕКРЕТНЫЙ ТЕКСТ И API-КЛЮЧ';
        $generator = new RecordingCueGenerator(exception: new RuntimeException($sentinel));
        $job = new GenerateScriptCues($generation->id);
        $last = null;

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                $this->runJobInstance($job, $generator);
            } catch (Throwable $exception) {
                $last = $exception;
            }
        }
        $job->failed($last ?? new RuntimeException('missing exception'));

        $generation->refresh();
        $this->assertSame('failed', $generation->status->value);
        $this->assertSame(3, $generation->attempts);
        $this->assertSame(3, $generation->provider_calls);
        $this->assertSame(3, $generation->failed_provider_calls);
        $this->assertSame('AI_PROVIDER_ERROR', $generation->error_code);
        $this->assertStringNotContainsString($sentinel, (string) $generation->error_message);
        $this->assertNotNull($generation->completed_at);
        foreach ($cards as $card) {
            $this->assertSame('failed', $card->refresh()->cueSet->status);
            $this->assertSame([], $card->cueSet->cues);
        }
        $this->assertSame([5, 15, 30], $job->backoff());
        $this->assertSame(3, $job->tries);
    }

    public function test_a_single_oversized_prompt_is_rejected_before_calling_the_provider(): void
    {
        config()->set('cue-cards.ai.max_prompt_bytes', 200);
        [$generation] = $this->queuedGeneration();
        $generator = new RecordingCueGenerator;

        try {
            $this->runJob($generation->id, $generator);
            $this->fail('Expected the prompt byte safeguard to reject the card.');
        } catch (InvalidArgumentException) {
            $this->assertSame([], $generator->requestedCardIds);
        }
    }

    /** @return array{AiGeneration, Script, list<Card>} */
    private function queuedGeneration(): array
    {
        Queue::fake();
        $user = User::factory()->create(['role' => Role::Superadmin]);
        $script = Script::query()->create([
            'user_id' => $user->id,
            'title' => 'Синтетический сценарий',
            'source_format' => 'markdown',
            'source_text' => 'Синтетический исходный текст.',
            'import_hash' => hash('sha256', 'synthetic import'),
            'status' => 'ready',
            'version' => 1,
        ]);
        $cards = [];
        foreach (['Первый блок.', 'Второй блок.'] as $position => $text) {
            $card = Card::query()->create([
                'script_id' => $script->id,
                'position' => $position,
                'title' => 'Блок '.($position + 1),
                'full_text' => $text,
                'content_hash' => hash('sha256', $text),
                'version' => 1,
            ]);
            CueSet::query()->create([
                'card_id' => $card->id,
                'cues' => [],
                'source_hash' => null,
                'status' => 'missing',
                'generation_id' => null,
                'manually_edited' => false,
                'version' => 1,
            ]);
            $cards[] = $card;
        }

        $generation = app(StartScriptCueGeneration::class)->handle($user, $script);

        return [$generation, $script, $cards];
    }

    private function runJob(string $generationId, CueGenerator $generator): void
    {
        $this->runJobInstance(new GenerateScriptCues($generationId), $generator);
    }

    private function runJobInstance(GenerateScriptCues $job, CueGenerator $generator): void
    {
        $this->app->instance(CueGenerator::class, $generator);
        $this->app->call([$job, 'handle']);
    }
}

final class RecordingCueGenerator implements CueGenerator
{
    /** @var list<list<string>> */
    public array $requestedCardIds = [];

    private bool $mutated = false;

    public function __construct(
        private readonly mixed $duringFirstCall = null,
        private readonly ?Throwable $exception = null,
    ) {}

    public function generate(CueGenerationRequest $request): CueGenerationResult
    {
        $this->requestedCardIds[] = $request->cardIds();
        if (! $this->mutated && is_callable($this->duringFirstCall)) {
            ($this->duringFirstCall)();
            $this->mutated = true;
        }
        if ($this->exception !== null) {
            throw $this->exception;
        }

        return CueGenerationResult::fromProviderResponse($request, ['cards' => array_map(
            static fn (string $cardId): array => [
                'card_id' => $cardId,
                'cues' => ['Короткий первый', 'Короткий второй', 'Короткий третий'],
            ],
            $request->cardIds(),
        )], 200, 'provider-request', 10, 4);
    }
}
