<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('script_id')->constrained('scripts')->cascadeOnDelete();
            $table->unsignedInteger('position');
            $table->string('title');
            $table->text('full_text');
            $table->string('content_hash', 64);
            $table->unsignedBigInteger('version')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['script_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cards');
    }
};
