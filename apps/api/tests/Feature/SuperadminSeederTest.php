<?php

namespace Tests\Feature;

use App\Domain\Identity\Role;
use App\Models\User;
use Database\Seeders\SuperadminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class SuperadminSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        foreach (['SUPERADMIN_NAME', 'SUPERADMIN_EMAIL', 'SUPERADMIN_PASSWORD'] as $key) {
            Env::getRepository()->clear($key);
        }

        parent::tearDown();
    }

    public function test_it_fails_loudly_when_required_configuration_is_missing(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SUPERADMIN_NAME');

        $this->seed(SuperadminSeeder::class);
    }

    public function test_it_creates_the_server_controlled_superadmin_from_environment(): void
    {
        Env::getRepository()->set('SUPERADMIN_NAME', 'Владелец');
        Env::getRepository()->set('SUPERADMIN_EMAIL', 'owner@example.test');
        Env::getRepository()->set('SUPERADMIN_PASSWORD', 'a-long-secret-password');

        $this->seed(SuperadminSeeder::class);

        $user = User::query()->where('email', 'owner@example.test')->sole();
        $this->assertSame('Владелец', $user->name);
        $this->assertSame(Role::Superadmin, $user->role);
        $this->assertTrue(Hash::check('a-long-secret-password', $user->password));
        $this->assertNotSame('a-long-secret-password', $user->password);
    }
}
