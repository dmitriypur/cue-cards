<?php

namespace App\Domain\Scripts;

final readonly class ContentHash
{
    public function __construct(public string $value)
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $value)) {
            throw new InvalidScriptSnapshot('Content hash must be a lowercase SHA-256 digest.');
        }
    }

    public static function fromText(string $text): self
    {
        return new self(hash('sha256', $text));
    }

    public function matches(string $text): bool
    {
        return hash_equals($this->value, hash('sha256', $text));
    }
}
