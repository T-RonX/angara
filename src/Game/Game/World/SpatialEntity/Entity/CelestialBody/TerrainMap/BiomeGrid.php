<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use App\Game\Game\World\Noise\NoiseGrid;
use App\Game\Game\World\SpatialGrid\SpatialGrid;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class BiomeGrid extends SpatialGrid
{
    /**
     * @param Biome[] $biomes
     */
    public function __construct(
        public readonly array $biomes,
        public readonly NoiseGrid $rawGrid,
        public readonly NoiseGrid $normalizedGrid,
        protected(set) NoiseGrid $grid,
    ) {
        parent::__construct($grid);
    }
}
