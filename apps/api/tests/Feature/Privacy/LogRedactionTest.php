<?php

namespace Tests\Feature\Privacy;

use App\Models\User;
use App\Support\SafeContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LogRedactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_logging_context_excludes_user_text_and_every_secret(): void
    {
        $sentinels = [
            'script' => 'СЕКРЕТНЫЙ СЦЕНАРИЙ SENTINEL',
            'password' => 'password-sentinel',
            'token' => 'bearer-token-sentinel',
            'ai_key' => 'ai-key-sentinel',
        ];
        $request = Request::create('/api/v1/sync/commands', 'POST', [
            'script_text' => $sentinels['script'],
            'password' => $sentinels['password'],
            'ai_key' => $sentinels['ai_key'],
            'operation_id' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75421',
            'generation_id' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75422',
        ], server: [
            'HTTP_AUTHORIZATION' => 'Bearer '.$sentinels['token'],
            'HTTP_X_CORRELATION_ID' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75420',
        ]);

        Log::spy();
        $context = SafeContext::fromRequest($request, outcome: 'rejected');
        Log::info('privacy.probe', $context);

        $encoded = json_encode($context, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        foreach ($sentinels as $sentinel) {
            $this->assertStringNotContainsString($sentinel, $encoded);
        }
        $this->assertSame([
            'correlation_id' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75420',
            'operation_id' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75421',
            'generation_id' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75422',
            'outcome' => 'rejected',
        ], $context);
        Log::shouldHaveReceived('info')->once()->with('privacy.probe', $context);
    }

    public function test_allowlisted_request_ids_reject_secret_shaped_values(): void
    {
        $sentinel = 'bearer-token-sentinel';
        $request = Request::create('/api/v1/sync/commands', 'POST', [
            'operation_id' => $sentinel,
            'generation_id' => $sentinel,
        ], server: ['HTTP_X_CORRELATION_ID' => $sentinel]);

        $context = SafeContext::fromRequest($request, outcome: 'rejected');

        $this->assertSame([
            'outcome' => 'rejected',
        ], $context);
        $this->assertStringNotContainsString($sentinel, json_encode($context, JSON_THROW_ON_ERROR));
    }

    public function test_unknown_api_path_is_not_copied_into_log_context(): void
    {
        $sentinel = 'bearer-token-sentinel';
        Log::spy();

        $this->getJson('/api/v1/'.$sentinel)->assertNotFound();

        Log::shouldNotHaveReceived('info');
    }

    public function test_login_sync_and_ai_failures_log_only_safe_request_context(): void
    {
        $sentinels = ['СЕКРЕТНЫЙ СЦЕНАРИЙ', 'password-sentinel', 'bearer-token-sentinel', 'ai-key-sentinel'];
        config()->set('ai.providers.deepseek.key', $sentinels[3]);
        Log::spy();

        $headers = [
            'Authorization' => 'Bearer '.$sentinels[2],
            'X-Correlation-ID' => '0198a70d-5c68-7a3f-8d8e-9d51b1e75441',
        ];
        $login = $this->withHeaders($headers)->postJson('/api/v1/auth/login', [
            'email' => 'missing@example.test',
            'password' => $sentinels[1],
            'device_name' => $sentinels[0],
        ]);
        $this->assertSame(401, $login->status(), $login->getContent());
        Sanctum::actingAs(User::factory()->create());
        $sync = $this->withHeaders($headers)->postJson('/api/v1/sync/commands', [
            'operation_id' => $sentinels[1],
            'commands' => [['script_text' => $sentinels[0]]],
        ]);
        $this->assertSame(422, $sync->status(), $sync->getContent());
        $ai = $this->withHeaders($headers)->postJson('/api/v1/scripts/0198a70d-5c68-7a3f-8d8e-9d51b1e75442/cue-generations', [
            'script_text' => $sentinels[0],
            'generation_id' => $sentinels[3],
        ]);
        $this->assertSame(404, $ai->status(), $ai->getContent());

        Log::shouldHaveReceived('info')->times(3)->withArgs(function (string $event, array $context) use ($sentinels): bool {
            $encoded = json_encode($context, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            foreach ($sentinels as $sentinel) {
                $this->assertStringNotContainsString($sentinel, $encoded);
            }

            return $event === 'api.request'
                && ! array_key_exists('operation_id', $context)
                && ! array_key_exists('generation_id', $context)
                && array_key_exists('route', $context)
                && array_key_exists('outcome', $context);
        });
    }
}
