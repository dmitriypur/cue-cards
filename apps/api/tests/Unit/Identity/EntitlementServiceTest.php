<?php

namespace Tests\Unit\Identity;

use App\Application\Identity\EntitlementService;
use App\Domain\Identity\Feature;
use App\Domain\Identity\Role;
use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class EntitlementServiceTest extends TestCase
{
    #[DataProvider('features')]
    public function test_superadmin_is_allowed_every_product_feature(Feature $feature): void
    {
        $service = new EntitlementService;
        $user = new User(['role' => Role::Superadmin]);

        $this->assertTrue($service->allows($user, $feature));
        $this->assertContains($feature->value, $service->allFor($user));
    }

    public function test_normal_user_receives_only_explicit_free_features(): void
    {
        $service = new EntitlementService;
        $user = new User(['role' => Role::User]);

        $this->assertTrue($service->allows($user, Feature::OfflineScripts));
        $this->assertTrue($service->allows($user, Feature::OfflineRecording));
        $this->assertFalse($service->allows($user, Feature::CloudSync));
        $this->assertFalse($service->allows($user, Feature::AiCues));
        $this->assertSame([
            Feature::OfflineScripts->value,
            Feature::OfflineRecording->value,
        ], $service->allFor($user));
    }

    public function test_technical_safeguards_are_not_commercial_entitlements(): void
    {
        $values = array_map(
            static fn (Feature $feature): string => $feature->value,
            Feature::cases(),
        );

        $this->assertNotContains('rate_limit', $values);
        $this->assertNotContains('payload_limit', $values);
        $this->assertNotContains('usage_accounting', $values);
    }

    /**
     * @return iterable<string, array{Feature}>
     */
    public static function features(): iterable
    {
        foreach (Feature::cases() as $feature) {
            yield $feature->value => [$feature];
        }
    }
}
