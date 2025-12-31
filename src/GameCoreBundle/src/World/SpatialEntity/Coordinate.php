<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity;

use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
readonly class Coordinate
{
    public function __construct(
        public int $x,
        public int $y,
    ) {
    }
}
