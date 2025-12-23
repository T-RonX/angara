<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet;

use App\Game\Game\Environment\Generator\Planet\Terrain\MapDescriptor;
use App\Game\Game\Environment\Generator\Planet\Terrain\NoiseGenerator;
use App\Game\Game\Environment\Generator\Planet\Terrain\ResourceMapGenerator;
use SplFixedArray;

class BodyGenerator
{
    public function __construct(
        private readonly NoiseGenerator $noiseGenerator,
        private readonly ResourceMapGenerator $resourceGenerator,
    ) {
    }

    public function generate(?string $seed, MapDescriptor $mapDescriptor): Body
    {
        $thresholds = $mapDescriptor->getThresholds();

//        $thresholds = [0.2, 0.4, 0.6, 0.8];

        $noiseMapRaw = $this->noiseGenerator->generate($mapDescriptor, $seed);
        $normalizeNoiseMap = $this->normalizeNoiseMap($noiseMapRaw);
        $quantizedNoiseMap = $this->quantizedNoiseMap($normalizeNoiseMap, $thresholds);
        $bordersMap = $this->getBorders($normalizeNoiseMap, $quantizedNoiseMap, $thresholds, $mapDescriptor);

        $resourceMap = $this->resourceGenerator->generate($mapDescriptor->getSize(), 1, 1, null);


        return new Body($quantizedNoiseMap, $bordersMap, $resourceMap);
    }

    /**
     * Finds the border areas between the height thresholds. A border is a region, not a line.
     * Cells are marked as borders if they are within borderThreshold distance of a threshold value
     * AND are reachable from a terrain transition through other threshold-proximate cells.
     *
     * @param SplFixedArray<int, SplFixedArray<float>> $noiseMap
     * @param SplFixedArray<int, SplFixedArray<float>> $quantizedMap
     * @param float[] $thresholds
     *
     * @return SplFixedArray<int, SplFixedArray<float|null>>
     */
    private function getBorders(
        SplFixedArray $noiseMap,
        SplFixedArray $quantizedMap,
        array $thresholds,
        MapDescriptor $mapDescriptor
    ): SplFixedArray
    {
        $borderThreshold = $mapDescriptor->borderThreshold;
        $borderMap = $this->cloneNoiseMap($noiseMap);
        $height = $noiseMap->count();
        $width = $noiseMap[0]->count();

        // Initialize all cells to null
        for ($x = 0; $x < $height; ++$x)
        {
            for ($y = 0; $y < $width; ++$y)
            {
                $borderMap[$x][$y] = null;
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
                $noiseValue = $noiseMap[$x][$y];

                // Check if this cell's noise value is within borderThreshold of any threshold
                if (!$this->isNearThreshold($noiseValue, $thresholds, $borderThreshold))
                {
                    continue;
                }

                // Check if this cell neighbors a different terrain level
                $currentLevel = $quantizedMap[$x][$y];
                $neighborsThreshold = false;

                foreach ($directions as [$dx, $dy])
                {
                    $nx = $x + $dx;
                    $ny = $y + $dy;

                    if ($nx < 0 || $nx >= $height || $ny < 0 || $ny >= $width)
                    {
                        continue;
                    }

                    if ($quantizedMap[$nx][$ny] !== $currentLevel)
                    {
                        $neighborsThreshold = true;
                        break;
                    }
                }

                if ($neighborsThreshold)
                {
                    $queue[] = [$x, $y];
                    $visited["$x,$y"] = true;
                    $borderMap[$x][$y] = $noiseValue;
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

                if ($this->isNearThreshold($noiseMap[$nx][$ny], $thresholds, $borderThreshold))
                {
                    $visited["$nx,$ny"] = true;
                    $borderMap[$nx][$ny] = $noiseMap[$nx][$ny];
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
     * @param float[] $thresholds
     * @param float $borderThreshold
     *
     * @return bool
     */
    private function isNearThreshold(float $noiseValue, array $thresholds, float $borderThreshold): bool
    {
        foreach ($thresholds as $threshold)
        {
            if (abs($noiseValue - $threshold) <= $borderThreshold)
            {
                return true;
            }
        }

        return false;
    }

    /**
     * Normalize noise map to values between 0 and 1.
     *
     * @param SplFixedArray<int, SplFixedArray<float>> $noiseMap
     *
     * @return SplFixedArray<int, SplFixedArray<float>>
     */
    private function normalizeNoiseMap(SplFixedArray $noiseMap): SplFixedArray
    {
        $newMap = $this->cloneNoiseMap($noiseMap);
        $min = PHP_FLOAT_MAX;
        $max = -PHP_FLOAT_MAX;

        foreach ($newMap as $row)
        {
            foreach ($row as $value)
            {
                if ($value < $min)
                {
                    $min = $value;
                }

                if ($value > $max)
                {
                    $max = $value;
                }
            }
        }

        $range = $max - $min;

        foreach ($newMap as $x => $row)
        {
            foreach ($row as $y => $value)
            {
                $newMap[$x][$y] = ($value - $min) / $range;
            }
        }

        return $newMap;
    }


    /**
     * Quantized the noice map to align with the give thresholds indices.
     *
     * @param SplFixedArray<int, SplFixedArray<float>> $noiseMap
     *
     * @return SplFixedArray<int, SplFixedArray<float>>
    */
    private function quantizedNoiseMap(SplFixedArray $noiseMap, array $thresholds): SplFixedArray
    {
        $newMap = $this->cloneNoiseMap($noiseMap);
        $max = count($thresholds);

        foreach ($newMap as $x => $row)
        {
            foreach ($row as $y => $value)
            {
                foreach ($thresholds as $i => $t)
                {
                    if ($value < $t)
                    {
                        $newMap[$x][$y] = $i;
                        continue 2;
                    }
                }

                $newMap[$x][$y] = $max;
            }
        }

        return $newMap;
    }

    /**
     * @param SplFixedArray<int, SplFixedArray<float>> $noiseMap
     *
     * @return SplFixedArray<int, SplFixedArray<float>>
     */
    private function cloneNoiseMap(SplFixedArray $noiseMap): SplFixedArray
    {
        $height = $noiseMap->count();
        $clone = new SplFixedArray($height);

        for ($x = 0; $x < $height; ++$x)
        {
            $row = $noiseMap[$x];
            $width = $row->count();

            $newRow = new SplFixedArray($width);

            for ($y = 0; $y < $width; $y++)
            {
                $newRow[$y] = $row[$y];
            }

            $clone[$x] = $newRow;
        }

        return $clone;
    }
}
