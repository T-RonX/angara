<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialEntity\Builder\CelestialBody;

use App\Game\Game\World\Noise\NoiseGrid;
use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;
use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BorderGrid;
use SplFixedArray;

class CelestialBodyBorderGridBuilder
{
    public function __construct(
        private readonly CelestialBodyFactory $factory,
    ) {
    }

    /**
     * @param Biome[] $biomes
     */
    public function create(BiomeGrid $biomeGrid, array $biomes, float $borderThreshold): BorderGrid
    {
        $borderGrid = $this->getBorders($biomeGrid->normalizedGrid, $biomeGrid->grid, $biomes, $borderThreshold);

        return $this->factory->createBorderGrid($borderGrid, $borderThreshold);
    }

    /**
     * Finds the border areas between the height thresholds. A border is a region, not a line.
     * Cells are marked as borders if they are within borderThreshold distance of a threshold value
     * AND are reachable from a terrain transition through other threshold-proximate cells.
     *
     * @param Biome[] $biomes
     *
     * @return SplFixedArray<int, SplFixedArray<float|null>>
     */
    private function getBorders(
        NoiseGrid $normalizeNoiseGrid,
        NoiseGrid $quantizedGrid,
        array $biomes,
        float $borderThreshold
    ): NoiseGrid
    {
        $height = $normalizeNoiseGrid->grid->count();
        $width = $normalizeNoiseGrid->grid[0]->count();
        $borderMap = $normalizeNoiseGrid->clone();

        // Initialize all cells to null
        for ($x = 0; $x < $height; ++$x)
        {
            for ($y = 0; $y < $width; ++$y)
            {
                $borderMap->grid[$x][$y] = null;
            }
        }

        $visited = [];
        $queue = [];
        $directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        // First pass: find cells that neighbor a different terrain level AND are near a threshold
        for ($x = 0; $x < $height; ++$x)
        {
            for ($y = 0; $y < $width; ++$y)
            {
                $noiseValue = $normalizeNoiseGrid->grid[$x][$y];

                // Check if this cell's noise value is within borderThreshold of any threshold
                if (!$this->isNearThreshold($noiseValue, $biomes, $borderThreshold))
                {
                    continue;
                }

                // Check if this cell neighbors a different terrain level
                $currentLevel = $quantizedGrid->grid[$x][$y];
                $neighborsThreshold = false;

                foreach ($directions as [$dx, $dy])
                {
                    $nx = $x + $dx;
                    $ny = $y + $dy;

                    if ($nx < 0 || $nx >= $height || $ny < 0 || $ny >= $width)
                    {
                        continue;
                    }

                    if ($quantizedGrid->grid[$nx][$ny] !== $currentLevel)
                    {
                        $neighborsThreshold = true;
                        break;
                    }
                }

                if ($neighborsThreshold)
                {
                    $queue[] = [$x, $y];
                    $visited["$x,$y"] = true;
                    $borderMap->grid[$x][$y] = $noiseValue;
                }
            }
        }

        // BFS to expand borders through cells near thresholds
        while ($current = array_shift($queue))
        {
            [$cx, $cy] = $current;

            foreach ($directions as [$dx, $dy])
            {
                $nx = $cx + $dx;
                $ny = $cy + $dy;

                if ($nx < 0 || $nx >= $height || $ny < 0 || $ny >= $width)
                {
                    continue;
                }

                if (isset($visited["$nx,$ny"]))
                {
                    continue;
                }

                if ($this->isNearThreshold($normalizeNoiseGrid->grid[$nx][$ny], $biomes, $borderThreshold))
                {
                    $visited["$nx,$ny"] = true;
                    $borderMap->grid[$nx][$ny] = $normalizeNoiseGrid->grid[$nx][$ny];
                    $queue[] = [$nx, $ny];
                }
            }
        }

        return $borderMap;
    }

    /**
     * Helper method to check if a noise value is near any threshold.
     *
     * @param float $noiseValue
     * @param Biome[] $biomes
     * @param float $borderThreshold
     *
     * @return bool
     */
    private function isNearThreshold(float $noiseValue, array $biomes, float $borderThreshold): bool
    {
        foreach ($biomes as $biome)
        {
            if (abs($noiseValue - $biome->threshold) <= $borderThreshold)
            {
                return true;
            }
        }

        return false;
    }
}
