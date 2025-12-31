<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity;

use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
abstract class SpatialEntity
{
    public function __construct(
        public Coordinate $coordinate,
    ) {
    }
}
