<?php

namespace App\Domain\AiAssistance;

enum GenerationStatus: string
{
    case Queued = 'queued';
    case Running = 'running';
    case Completed = 'completed';
    case Failed = 'failed';
}
