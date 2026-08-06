<?php

namespace Database\Seeders;

use App\Domain\Identity\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class SuperadminSeeder extends Seeder
{
    public function run(): void
    {
        $name = $this->required('SUPERADMIN_NAME');
        $email = $this->required('SUPERADMIN_EMAIL');
        $password = $this->required('SUPERADMIN_PASSWORD');

        User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
                'role' => Role::Superadmin,
            ],
        );
    }

    private function required(string $key): string
    {
        $value = env($key);

        if (! is_string($value) || trim($value) === '') {
            throw new RuntimeException("{$key} must be configured before seeding.");
        }

        return $value;
    }
}
