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
            'Ты создаёшь русскоязычный опорный план речи для карточек сценария.',
            'Для каждой переданной card_id верни ровно один объект и по одному короткому законченному тезису на каждую самостоятельную мысль полного текста.',
            'Выбирай количество только по смыслу, сохраняй исходный порядок и не дроби мысли ради заданного числа.',
            'Сохраняй важные причины, аргументы, примеры, выводы и переходы.',
            'Используй outline сценария только для связности: не переноси факты из соседних карточек, не добавляй новые факты и никогда не переписывай исходный текст.',
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
