<?php

namespace App\Application\AiAssistance;

use App\Models\AiGeneration;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class GetAiGeneration
{
    public function handle(User $user, AiGeneration $generation): AiGeneration
    {
        if ((int) $generation->user_id !== (int) $user->id) {
            throw (new ModelNotFoundException)->setModel(AiGeneration::class, [$generation->id]);
        }

        return $generation;
    }
}
