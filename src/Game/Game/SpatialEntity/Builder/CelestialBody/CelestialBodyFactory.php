<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity\Builder\CelestialBody;

use App\Game\Game\Noise\NoiseGrid;
use App\Game\Game\SpacialGrid\SpatialGrid;
use App\Game\Game\SpatialEntity\Coordinate;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\CelestialBody;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\BorderGrid;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\TerrainMap;

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
