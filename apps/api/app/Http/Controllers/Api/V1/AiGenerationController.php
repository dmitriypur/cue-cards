<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\AiAssistance\GetAiGeneration;
use App\Application\AiAssistance\StartCardCueGeneration;
use App\Application\AiAssistance\StartScriptCueGeneration;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\AiGenerationResource;
use App\Models\AiGeneration;
use App\Models\Card;
use App\Models\Script;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiGenerationController extends Controller
{
    public function startScript(Request $request, Script $script, StartScriptCueGeneration $start): JsonResponse
    {
        $validated = $request->validate(['operation_id' => ['sometimes', 'uuid']]);

        return (new AiGenerationResource($start->handle(
            $request->user(),
            $script,
            $validated['operation_id'] ?? null,
        )))
            ->response()->setStatusCode(202);
    }

    public function startCard(Request $request, Card $card, StartCardCueGeneration $start): JsonResponse
    {
        $validated = $request->validate([
            'replace_manual' => ['sometimes', 'boolean'],
            'operation_id' => ['sometimes', 'uuid'],
        ]);

        return (new AiGenerationResource($start->handle(
            $request->user(),
            $card,
            (bool) ($validated['replace_manual'] ?? false),
            $validated['operation_id'] ?? null,
        )))
            ->response()->setStatusCode(202);
    }

    public function show(Request $request, AiGeneration $generation, GetAiGeneration $get): AiGenerationResource
    {
        return new AiGenerationResource($get->handle($request->user(), $generation));
    }
}
