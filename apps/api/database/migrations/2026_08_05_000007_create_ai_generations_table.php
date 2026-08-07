<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_generations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('script_id')->constrained('scripts')->cascadeOnDelete();
            $table->foreignUuid('card_id')->nullable()->constrained('cards')->nullOnDelete();
            $table->string('provider');
            $table->string('model');
            $table->string('prompt_version');
            $table->json('source_hashes');
            $table->string('status');
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedInteger('provider_calls')->default(0);
            $table->unsignedInteger('failed_provider_calls')->default(0);
            $table->unsignedInteger('completed_cards')->default(0);
            $table->unsignedInteger('total_cards');
            $table->string('provider_request_id')->nullable();
            $table->unsignedBigInteger('input_tokens')->default(0);
            $table->unsignedBigInteger('output_tokens')->default(0);
            $table->unsignedBigInteger('cost_minor_units')->nullable();
            $table->string('error_code')->nullable();
            $table->string('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
            $table->index(['script_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_generations');
    }
};
