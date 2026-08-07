<?php

namespace Tests\Feature\Api\V1;

use App\Jobs\GenerateScriptCues;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class TechnicalSafeguardsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        RateLimiter::clear('login:127.0.0.1');
        parent::tearDown();
    }

    public function test_login_is_technically_rate_limited(): void
    {
        $payload = [
            'email' => 'missing@example.test',
            'password' => 'synthetic-password',
            'device_name' => 'Android',
        ];

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', $payload)->assertUnauthorized();
        }

        $this->postJson('/api/v1/auth/login', $payload)
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    public function test_ai_worker_keeps_the_three_attempt_technical_cap(): void
    {
        $job = new GenerateScriptCues('0198a70d-5c68-7a3f-8d8e-9d51b1e75421');

        $this->assertSame(3, $job->tries);
        $this->assertSame([5, 15, 30], $job->backoff());
        $this->assertSame(65536, config('cue-cards.ai.max_prompt_bytes'));
    }
}
