<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity\Builder\CelestialBody;

use App\GameCoreBundle\World\Noise\NoiseGrid;
use App\GameCoreBundle\World\SpatialEntity\Coordinate;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\CelestialBody;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BorderGrid;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\TerrainMap;

class CelestialBodyFactory
{
    public function createCelestialBody(Coordinate $location, TerrainMap $terrainMap): CelestialBody
    {
        return new CelestialBody($location, $terrainMap);
    }

    public function createTerrainMap(
        BiomeGrid $biomeGrid,
        BorderGrid $borderGrid,
//        SpatialGrid $resourceGrid,
    ): TerrainMap
    {
        return new TerrainMap($biomeGrid, $borderGrid/*, $resourceGrid*/);
    }

    /**
     * @param Biome[] $biomes
     */
    public function createBiomeGrid(array $biomes, NoiseGrid $rawGrid, NoiseGrid $normalizedGrid, NoiseGrid $biomeGrid): BiomeGrid
    {
        return new BiomeGrid($biomes, $rawGrid, $normalizedGrid, $biomeGrid);
    }

    public function createBiome(float|null $threshold, string $name, string $color): Biome
    {
        return new Biome($threshold, $name, $color);
    }

    public function createBorderGrid(NoiseGrid $borderGrid, float $threshold): BorderGrid
    {
        return new BorderGrid($borderGrid, $threshold);
    }
}
