<?php

namespace App\Models;

use App\Domain\AiAssistance\GenerationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'script_id', 'card_id', 'operation_id', 'replace_manual',
    'provider', 'model', 'prompt_version', 'source_hashes', 'source_cue_versions',
    'status', 'attempts', 'provider_calls', 'failed_provider_calls',
    'completed_cards', 'total_cards',
    'provider_request_id', 'input_tokens', 'output_tokens', 'cost_minor_units',
    'error_code', 'error_message', 'started_at', 'completed_at',
])]
class AiGeneration extends Model
{
    use HasUuids;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Script, $this> */
    public function script(): BelongsTo
    {
        return $this->belongsTo(Script::class);
    }

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'source_hashes' => 'array',
            'source_cue_versions' => 'array',
            'replace_manual' => 'boolean',
            'status' => GenerationStatus::class,
            'attempts' => 'integer',
            'provider_calls' => 'integer',
            'failed_provider_calls' => 'integer',
            'completed_cards' => 'integer',
            'total_cards' => 'integer',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
            'cost_minor_units' => 'integer',
            'started_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
    }
}
