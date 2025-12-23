<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap;

use App\Game\Game\SpatialGrid\SpatialGrid;
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
