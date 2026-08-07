<?php

namespace App\Infrastructure\Ai;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;
use Stringable;

class CueCardsAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return implode(' ', [
            'Ты создаёшь краткие русскоязычные тезисы для карточек сценария.',
            'Верни для каждой переданной card_id ровно один объект и от 3 до 5 коротких непустых тезисов.',
            'Опирайся только на переданный полный текст, не добавляй факты и никогда не переписывай исходный текст.',
        ]);
    }

    /** @return array<string, Type> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'cards' => $schema->array()->items(
                $schema->object(fn (JsonSchema $item): array => [
                    'card_id' => $item->string()->required(),
                    'cues' => $item->array()->items($item->string())->required(),
                ]),
            )->required(),
        ];
    }
}
