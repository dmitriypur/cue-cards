<?php

namespace App\Application\Usage;

use App\Domain\AiAssistance\CueGenerationResult;
use App\Models\AiGeneration;

class RecordAiUsage
{
    public function handle(AiGeneration $generation, CueGenerationResult $result): void
    {
        AiGeneration::query()->whereKey($generation->id)->update([
            'provider_calls' => $generation->provider_calls + 1,
            'input_tokens' => $generation->input_tokens + $result->inputTokens,
            'output_tokens' => $generation->output_tokens + $result->outputTokens,
            'provider_request_id' => $result->providerRequestId,
        ]);

        $generation->refresh();
    }

    public function failed(AiGeneration $generation): void
    {
        AiGeneration::query()->whereKey($generation->id)->update([
            'provider_calls' => $generation->provider_calls + 1,
            'failed_provider_calls' => $generation->failed_provider_calls + 1,
        ]);

        $generation->refresh();
    }
}
