<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cue_sets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('card_id')->unique()->constrained('cards')->cascadeOnDelete();
            $table->json('cues');
            $table->string('source_hash', 64)->nullable();
            $table->string('status');
            $table->uuid('generation_id')->nullable()->index();
            $table->boolean('manually_edited')->default(false);
            $table->unsignedBigInteger('version')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cue_sets');
    }
};
