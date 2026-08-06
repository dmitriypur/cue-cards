<?php

namespace App\Application\Identity;

use App\Domain\Identity\Feature;
use App\Domain\Identity\Role;
use App\Models\User;

class EntitlementService
{
    /** @var list<Feature> */
    private const FREE_FEATURES = [
        Feature::OfflineScripts,
        Feature::OfflineRecording,
    ];

    public function allows(User $user, Feature $feature): bool
    {
        if ($user->role === Role::Superadmin) {
            return true;
        }

        return in_array($feature, self::FREE_FEATURES, true);
    }

    /** @return list<string> */
    public function allFor(User $user): array
    {
        $features = $user->role === Role::Superadmin
            ? Feature::cases()
            : self::FREE_FEATURES;

        return array_map(
            static fn (Feature $feature): string => $feature->value,
            $features,
        );
    }
}
