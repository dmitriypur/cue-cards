<?php

return [
    'ai' => [
        'model' => env('CUE_CARDS_AI_MODEL', 'deepseek-chat'),
        'prompt_version' => env('CUE_CARDS_AI_PROMPT_VERSION', '1'),
        'max_prompt_bytes' => (int) env('CUE_CARDS_AI_MAX_PROMPT_BYTES', 65536),
        'max_cue_characters' => (int) env('CUE_CARDS_AI_MAX_CUE_CHARACTERS', 200),
    ],
];
