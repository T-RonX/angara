<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap;

use App\GameCoreBundle\World\Noise\NoiseGrid;
use App\GameCoreBundle\World\SpatialGrid\SpatialGrid;
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
