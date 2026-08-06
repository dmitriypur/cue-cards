<?php

namespace App\Domain\Identity;

enum Role: string
{
    case Superadmin = 'superadmin';
    case User = 'user';
}
