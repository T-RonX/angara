<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity\Entity\CelestialBody;

use App\Game\Game\SpatialEntity\Coordinate;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\TerrainMap;
use App\Game\Game\SpatialEntity\SpatialEntity;
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
