<?php

namespace Tests\Integration\Sync;

use App\Application\Sync\SubmitSyncCommands;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class ConcurrentSubmitSyncCommandsTest extends TestCase
{
    private ?int $createdUserId = null;

    private ?string $barrierRoot = null;

    public function test_concurrent_exact_retries_apply_once_and_return_the_original_result(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Concurrent idempotency is verified against PostgreSQL.');
        }
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Concurrent idempotency requires pcntl.');
        }

        Artisan::call('migrate:fresh', ['--force' => true]);

        $user = User::factory()->create();
        $this->createdUserId = $user->id;
        $command = $this->command();
        $root = tempnam(sys_get_temp_dir(), 'cue-sync-race-');
        if ($root === false) {
            throw new RuntimeException('Unable to create a race-test barrier.');
        }
        unlink($root);
        $this->barrierRoot = $root;

        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('Unable to fork the race test.');
        }
        if ($pid === 0) {
            $this->runContender('child', 'parent', $root, $user->id, $command);
            exit(0);
        }

        $this->runContender('parent', 'child', $root, $user->id, $command);
        pcntl_waitpid($pid, $status);

        $results = [
            json_decode((string) file_get_contents("{$root}.parent.result"), true, flags: JSON_THROW_ON_ERROR),
            json_decode((string) file_get_contents("{$root}.child.result"), true, flags: JSON_THROW_ON_ERROR),
        ];
        foreach (glob("{$root}.*") ?: [] as $path) {
            unlink($path);
        }

        $this->assertSame(0, pcntl_wexitstatus($status));
        $this->assertArrayNotHasKey('error', $results[0]);
        $this->assertArrayNotHasKey('error', $results[1]);
        $this->assertSame([1, 1], array_column($results, 'version'));
        $duplicates = array_column($results, 'duplicate');
        sort($duplicates);
        $this->assertSame([false, true], $duplicates);
        $this->assertDatabaseCount('sync_operations', 1);
        $this->assertDatabaseCount('sync_changes', 1);
    }

    protected function tearDown(): void
    {
        if ($this->createdUserId !== null) {
            DB::purge();
            DB::reconnect();
            User::query()->whereKey($this->createdUserId)->delete();
        }

        if ($this->barrierRoot !== null) {
            foreach (glob("{$this->barrierRoot}.*") ?: [] as $path) {
                unlink($path);
            }
        }

        parent::tearDown();
    }

    /**
     * @param  array<string, mixed>  $command
     */
    private function runContender(string $name, string $other, string $root, int $userId, array $command): void
    {
        DB::purge();
        DB::reconnect();
        $waiting = true;
        DB::connection()->beforeExecuting(static function (string $query) use (&$waiting, $name, $other, $root): void {
            if (! $waiting || ! str_contains($query, 'sync_operations')) {
                return;
            }
            $waiting = false;
            touch("{$root}.{$name}.ready");
            $deadline = microtime(true) + 5;
            while (! file_exists("{$root}.{$other}.ready")) {
                if (microtime(true) >= $deadline) {
                    throw new RuntimeException('Race-test barrier timed out.');
                }
                usleep(10_000);
            }
        });

        try {
            $change = app(SubmitSyncCommands::class)->handle(User::query()->findOrFail($userId), [$command])->results[0];
            $result = ['version' => $change->version, 'duplicate' => $change->duplicate];
        } catch (Throwable $exception) {
            $result = ['error' => $exception::class, 'message' => $exception->getMessage()];
        }

        file_put_contents("{$root}.{$name}.result", json_encode($result, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function command(): array
    {
        $script = '0198a70d-a717-70ae-a41d-905a2237bd18';
        $card = '0198a70e-23a2-73df-8387-34636552833a';
        $text = 'Первый синтетический блок.';
        $hash = hash('sha256', $text);

        return ['operation_id' => '0198a70d-4f72-70ad-bb3f-35b64f6ee1b1', 'aggregate_id' => $script, 'type' => 'script.replace', 'base_version' => 0, 'created_at' => '2026-08-07T09:00:00+00:00', 'payload' => [
            'id' => $script, 'title' => 'Синтетический сценарий', 'source_format' => 'markdown', 'source_text' => $text,
            'import_hash' => hash('sha256', 'import'), 'status' => 'ready', 'version' => 0, 'last_opened_at' => null,
            'updated_at' => '2026-08-07T09:00:00+00:00', 'deleted_at' => null, 'cards' => [[
                'id' => $card, 'script_id' => $script, 'position' => 0, 'title' => 'Блок', 'full_text' => $text,
                'content_hash' => $hash, 'version' => 0, 'deleted_at' => null, 'cue_set' => ['id' => '0198a70e-5670-704a-86bb-ced23df0704f', 'card_id' => $card, 'cues' => ['Один', 'Два', 'Три'], 'source_hash' => $hash, 'status' => 'ready', 'generation_id' => null, 'manually_edited' => false, 'version' => 0],
            ]],
        ]];
    }
}
