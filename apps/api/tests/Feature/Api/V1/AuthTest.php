<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Identity\Feature;
use App\Domain\Identity\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_superadmin_can_login_and_receives_every_entitlement(): void
    {
        $user = User::factory()->create([
            'email' => 'owner@example.test',
            'password' => Hash::make('correct-password'),
            'role' => Role::Superadmin,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-password',
            'device_name' => 'Pixel 9',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.role', Role::Superadmin->value)
            ->assertJsonCount(count(Feature::cases()), 'data.user.entitlements');

        $this->assertNotEmpty($response->json('data.access_token'));
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'Pixel 9',
        ]);
    }

    public function test_invalid_login_uses_the_stable_error_envelope(): void
    {
        User::factory()->create([
            'email' => 'owner@example.test',
            'password' => Hash::make('correct-password'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'wrong-password',
            'device_name' => 'Pixel 9',
        ])->assertUnauthorized()
            ->assertJsonPath('error.code', 'AUTH_INVALID_CREDENTIALS')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
    }

    public function test_unknown_email_uses_the_same_public_authentication_error(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'unknown@example.test',
            'password' => 'wrong-password',
            'device_name' => 'Pixel 9',
        ])->assertUnauthorized()
            ->assertJsonPath('error.code', 'AUTH_INVALID_CREDENTIALS')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
    }

    public function test_me_requires_a_sanctum_token(): void
    {
        $this->getJson('/api/v1/me')
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
    }

    public function test_authenticated_me_returns_identity_without_credentials(): void
    {
        $user = User::factory()->create(['role' => Role::Superadmin]);

        $response = $this->actingAs($user)->getJson('/api/v1/me');

        $response->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.role', Role::Superadmin->value)
            ->assertJsonCount(count(Feature::cases()), 'data.entitlements')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.access_token');
    }

    public function test_method_not_allowed_uses_a_safe_stable_error_envelope(): void
    {
        $response = $this->putJson('/api/v1/auth/login');

        $response->assertMethodNotAllowed()
            ->assertJsonPath('error.code', 'METHOD_NOT_ALLOWED')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
        $this->assertStringNotContainsString('bootstrap/app.php', $response->getContent());
        $this->assertStringNotContainsString('trace', $response->getContent());
    }

    public function test_unexpected_api_exception_uses_a_safe_stable_error_envelope(): void
    {
        Route::get('/api/v1/test-unexpected-error', static function (): never {
            throw new RuntimeException('sensitive internal sentinel');
        });

        $response = $this->getJson('/api/v1/test-unexpected-error');

        $response->assertInternalServerError()
            ->assertJsonPath('error.code', 'INTERNAL_ERROR')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id']]);
        $this->assertStringNotContainsString('sensitive internal sentinel', $response->getContent());
        $this->assertStringNotContainsString('trace', $response->getContent());
    }

    public function test_login_validation_uses_the_stable_error_envelope(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'not-an-email',
            'password' => '',
            'device_name' => '',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['code', 'message', 'correlation_id', 'fields']]);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('current');
        $other = $user->createToken('other');

        $this->withToken($current->plainTextToken)
            ->postJson('/api/v1/auth/logout')
            ->assertNoContent();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $current->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $other->accessToken->id]);
    }
}
