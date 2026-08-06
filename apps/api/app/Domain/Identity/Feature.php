<?php

namespace App\Domain\Identity;

enum Feature: string
{
    case OfflineScripts = 'offline_scripts';
    case OfflineRecording = 'offline_recording';
    case CloudSync = 'cloud_sync';
    case AiCues = 'ai_cues';
}
