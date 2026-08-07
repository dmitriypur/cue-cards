<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitSyncCommandsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'commands' => ['required', 'array', 'min:1', 'max:20'],
            'commands.*' => ['required', 'array'],
            'commands.*.operation_id' => ['required', 'uuid'],
            'commands.*.aggregate_id' => ['required', 'uuid'],
            'commands.*.type' => ['required', 'in:script.replace'],
            'commands.*.base_version' => ['required', 'integer', 'min:0'],
            'commands.*.payload' => ['required', 'array'],
            'commands.*.created_at' => ['required', 'date'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $commands = $this->input('commands', []);
            if (! is_array($commands)) {
                return;
            }

            foreach ($commands as $index => $command) {
                if (! is_array($command)) {
                    continue;
                }

                $encoded = json_encode($command['payload'] ?? [], JSON_UNESCAPED_UNICODE);
                if (is_string($encoded) && strlen($encoded) > 262144) {
                    $validator->errors()->add("commands.{$index}.payload", 'Snapshot is too large.');
                }
            }
        }];
    }
}
