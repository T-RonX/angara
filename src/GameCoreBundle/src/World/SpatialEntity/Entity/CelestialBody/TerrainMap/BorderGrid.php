<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use App\GameCoreBundle\World\Noise\NoiseGrid;
use App\GameCoreBundle\World\SpatialGrid\SpatialGrid;
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
