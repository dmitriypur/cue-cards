<?php

namespace App\Providers;

use App\Application\AiAssistance\CueGenerator;
use App\Infrastructure\Ai\LaravelAiCueGenerator;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(CueGenerator::class, LaravelAiCueGenerator::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', static fn (Request $request) => Limit::perMinute(5)->by('login:'.$request->ip()));
        RateLimiter::for('sync', static fn (Request $request) => Limit::perMinute(60)->by((string) $request->user()?->id));
        RateLimiter::for('ai-generation', static fn (Request $request) => Limit::perMinute(10)->by((string) $request->user()?->id));
        RateLimiter::for('ai-generation-status', static fn (Request $request) => Limit::perMinute(120)->by((string) $request->user()?->id));
    }
}
