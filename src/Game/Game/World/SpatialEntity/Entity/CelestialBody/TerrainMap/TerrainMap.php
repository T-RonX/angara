<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class TerrainMap
{
    public function __construct(
        public BiomeGrid $biomeGrid,
        public BorderGrid $borderGrid,
//        public SpatialGrid $resourceGrid,
    ) {

    }
}
