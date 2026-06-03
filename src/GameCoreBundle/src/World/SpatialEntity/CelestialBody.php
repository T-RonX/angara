<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity;

use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\TerrainMap;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class CelestialBody extends SpatialEntity
{
    public function __construct(
        Coordinate $coordinate,
        public readonly TerrainMap $terrainMap,
    ) {
        parent::__construct($coordinate);
    }
}
