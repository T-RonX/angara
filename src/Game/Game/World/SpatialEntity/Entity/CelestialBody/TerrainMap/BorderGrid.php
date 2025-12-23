<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use App\Game\Game\World\Noise\NoiseGrid;
use App\Game\Game\World\SpatialGrid\SpatialGrid;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class BorderGrid extends SpatialGrid
{
    public function __construct(
        protected(set) NoiseGrid $grid,
        public readonly float $threshold,
    ) {
        parent::__construct($grid);
    }
}
