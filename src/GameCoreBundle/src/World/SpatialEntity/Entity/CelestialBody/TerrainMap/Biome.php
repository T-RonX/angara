<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class Biome
{
    public function __construct(
        public float|null $threshold,
        public string $name,
        public string $color,
    ) {
    }
}
