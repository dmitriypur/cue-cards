<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Scripts\GetScript;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ScriptResource;
use App\Models\Script;
use Illuminate\Http\Request;

class ScriptController extends Controller
{
    public function show(Request $request, Script $script, GetScript $getScript): ScriptResource
    {
        return new ScriptResource($getScript->handle($request->user(), $script));
    }
}
