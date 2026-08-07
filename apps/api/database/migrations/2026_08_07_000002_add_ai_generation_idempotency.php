<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_generations', function (Blueprint $table): void {
            $table->uuid('operation_id')->nullable()->after('card_id');
            $table->boolean('replace_manual')->default(false)->after('operation_id');
            $table->json('source_cue_versions')->nullable()->after('source_hashes');
            $table->unique(['user_id', 'operation_id']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_generations', function (Blueprint $table): void {
            $table->dropUnique(['user_id', 'operation_id']);
            $table->dropColumn(['operation_id', 'replace_manual', 'source_cue_versions']);
        });
    }
};
