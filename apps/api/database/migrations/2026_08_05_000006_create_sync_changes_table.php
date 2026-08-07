<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_changes', function (Blueprint $table): void {
            $table->bigIncrements('cursor');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('aggregate_id');
            $table->unsignedBigInteger('version');
            $table->string('type');
            $table->json('snapshot');
            $table->timestamps();
            $table->index(['user_id', 'cursor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_changes');
    }
};
