<?php

namespace Tests\Unit\Scripts;

use App\Domain\Scripts\ScriptSnapshot;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ScriptSnapshotTest extends TestCase
{
    public function test_accepts_a_coherent_snapshot_and_returns_its_values(): void
    {
        $snapshot = ScriptSnapshot::fromArray($this->validSnapshot());

        $this->assertSame('0198a70d-a717-70ae-a41d-905a2237bd18', $snapshot->id);
        $this->assertSame(1, $snapshot->cards[1]['position']);
        $this->assertCount(6, $snapshot->cards[0]['cue_set']['cues']);
        $this->assertCount(1, $snapshot->cards[1]['cue_set']['cues']);
        $this->assertSame($this->validSnapshot(), $snapshot->toArray());
    }

    /** @param callable(array<string, mixed>): void $mutate */
    #[DataProvider('invalidSnapshots')]
    public function test_rejects_incoherent_domain_snapshots(callable $mutate): void
    {
        $payload = $this->validSnapshot();
        $mutate($payload);

        $this->expectException(InvalidArgumentException::class);
        ScriptSnapshot::fromArray($payload);
    }

    /** @return iterable<string, array{callable(array<string, mixed>): void}> */
    public static function invalidSnapshots(): iterable
    {
        yield 'invalid script UUID' => [static fn (array &$p) => $p['id'] = 'not-a-uuid'];
        yield 'aggregate mismatch' => [static fn (array &$p) => $p['cards'][0]['script_id'] = '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2'];
        yield 'cue/card mismatch' => [static fn (array &$p) => $p['cards'][0]['cue_set']['card_id'] = '0198a70e-23a2-73df-8387-34636552833b'];
        yield 'duplicate card UUID' => [static fn (array &$p) => $p['cards'][1]['id'] = $p['cards'][0]['id']];
        yield 'duplicate cue UUID' => [static fn (array &$p) => $p['cards'][1]['cue_set']['id'] = $p['cards'][0]['cue_set']['id']];
        yield 'non-contiguous active positions' => [static fn (array &$p) => $p['cards'][1]['position'] = 2];
        yield 'wrong content hash' => [static fn (array &$p) => $p['cards'][0]['content_hash'] = str_repeat('0', 64)];
        yield 'ready cue source mismatch' => [static fn (array &$p) => $p['cards'][0]['cue_set']['source_hash'] = str_repeat('0', 64)];
        yield 'ready cue list is empty' => [static fn (array &$p) => $p['cards'][0]['cue_set']['cues'] = []];
        yield 'duplicate cue' => [static fn (array &$p) => $p['cards'][0]['cue_set']['cues'][1] = $p['cards'][0]['cue_set']['cues'][0]];
        yield 'blank cue' => [static fn (array &$p) => $p['cards'][0]['cue_set']['cues'][1] = '   '];
        yield 'cue over 200 characters' => [static fn (array &$p) => $p['cards'][0]['cue_set']['cues'][1] = str_repeat('я', 201)];
        yield 'relative update timestamp' => [static fn (array &$p) => $p['updated_at'] = 'tomorrow'];
        yield 'normalized invalid update date' => [static fn (array &$p) => $p['updated_at'] = '2026-02-30T09:00:00+00:00'];
    }

    /** @return array<string, mixed> */
    private function validSnapshot(): array
    {
        $firstText = 'Первый синтетический блок.';
        $secondText = 'Второй синтетический блок.';

        return [
            'id' => '0198a70d-a717-70ae-a41d-905a2237bd18',
            'title' => 'Синтетический сценарий',
            'source_format' => 'markdown',
            'source_text' => "# Синтетический сценарий\n\n## Первый\n\n{$firstText}",
            'import_hash' => hash('sha256', 'synthetic import'),
            'status' => 'ready',
            'version' => 0,
            'last_opened_at' => null,
            'updated_at' => '2026-08-07T09:00:00+00:00',
            'deleted_at' => null,
            'cards' => [
                $this->card('0198a70e-23a2-73df-8387-34636552833a', 0, $firstText),
                $this->card('0198a70e-23a2-73df-8387-34636552833b', 1, $secondText),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function card(string $id, int $position, string $text): array
    {
        $hash = hash('sha256', $text);

        return [
            'id' => $id,
            'script_id' => '0198a70d-a717-70ae-a41d-905a2237bd18',
            'position' => $position,
            'title' => "Блок {$position}",
            'full_text' => $text,
            'content_hash' => $hash,
            'version' => 0,
            'deleted_at' => null,
            'cue_set' => [
                'id' => $position === 0
                    ? '0198a70e-5670-704a-86bb-ced23df0704f'
                    : '0198a70e-5670-704a-86bb-ced23df0705f',
                'card_id' => $id,
                'cues' => $position === 0
                    ? ['Мысль один', 'Мысль два', 'Мысль три', 'Мысль четыре', 'Мысль пять', 'Мысль шесть']
                    : ['Единственная мысль'],
                'source_hash' => $hash,
                'status' => 'ready',
                'generation_id' => null,
                'manually_edited' => false,
                'version' => 0,
            ],
        ];
    }
}
