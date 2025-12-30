<?php

declare(strict_types=1);

namespace App\System\Controller;

use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use SplFixedArray;

use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;

class TerrainRenderer
{
    private int $width;
    private int $height;
    private int $cellSize = 40;
    private SplFixedArray $grid;
    private SplFixedArray $rawGrid;
    private $image;
    private array $colors = [];
    private array $biomeRanges = [];
    private array $biomeLookupTable = [];
    private float $minNoise;
    private float $maxNoise;
    private float $bucketSize;
    /** @var Biome[] */
    private array $biomes;

    public function init(BiomeGrid $biomeGrid): void
    {
        ini_set('memory_limit', '-1');
        ini_set('max_execution_time', '-1');

        $this->biomes = $biomeGrid->biomes;
        $this->grid = $biomeGrid->getGrid();
        $this->rawGrid = $biomeGrid->rawGrid->grid;

        $this->width = count($this->grid);
        $this->height = count($this->grid[0] ?? []);

        // Create image
        $this->image = imagecreatetruecolor($this->width * $this->cellSize, $this->height * $this->cellSize);

        $this->initializeColors();
        $this->calculateBiomeRanges();
        $this->buildBiomeLookupTable();
    }

    private function initializeColors(): void
    {
        foreach ($this->biomes as $biomeId => $biome)
        {
            $color = $biome->color;
            $rgb = $this->hexToRgb($color);
            $this->colors[$biomeId] = imagecolorallocate($this->image, $rgb[0], $rgb[1], $rgb[2]);
        }
    }

    private function calculateBiomeRanges(): void
    {
        foreach ($this->biomes as $biomeId => $biome)
        {
            $this->biomeRanges[$biomeId] = ['min' => PHP_FLOAT_MAX, 'max' => PHP_FLOAT_MIN];
        }

        for ($x = 0; $x < $this->width; $x++)
        {
            for ($y = 0; $y < $this->height; $y++)
            {
                $biomeId = $this->grid[$x][$y];
                $noise = $this->rawGrid[$x][$y];

                $this->biomeRanges[$biomeId]['min'] = min($this->biomeRanges[$biomeId]['min'], $noise);
                $this->biomeRanges[$biomeId]['max'] = max($this->biomeRanges[$biomeId]['max'], $noise);
            }
        }
    }

    private function buildBiomeLookupTable(): void
    {
        // Build a lookup table that maps noise values to biome IDs
        // Use buckets to quickly find the closest biome without looping
        $this->minNoise = min(array_column($this->biomeRanges, 'min'));
        $this->maxNoise = max(array_column($this->biomeRanges, 'max'));
        $range = $this->maxNoise - $this->minNoise;

        // Create 1000 buckets across the noise range
        $bucketCount = 1000;
        $this->bucketSize = $range / $bucketCount;

        if ($this->bucketSize <= 0)
        {
            $this->bucketSize = 1.0;
        }

        for ($i = 0; $i < $bucketCount; $i++)
        {
            $noiseValue = $this->minNoise + ($i * $this->bucketSize);
            $this->biomeLookupTable[$i] = $this->findClosestBiome($noiseValue);
        }
    }

    private function findClosestBiome(float $noiseValue): int
    {
        $closestBiome = 0;
        $closestDistance = PHP_FLOAT_MAX;

        foreach ($this->biomeRanges as $biomeId => $range)
        {
            $distance = 0;
            if ($noiseValue < $range['min'])
            {
                $distance = $range['min'] - $noiseValue;
            }
            elseif ($noiseValue > $range['max'])
            {
                $distance = $noiseValue - $range['max'];
            }

            if ($distance < $closestDistance)
            {
                $closestDistance = $distance;
                $closestBiome = $biomeId;
            }
        }

        return $closestBiome;
    }

    private function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    private function getExtrapolatedNoiseAt(int $x, int $y): float
    {
        if ($x >= 0 && $x < $this->width && $y >= 0 && $y < $this->height)
        {
            return $this->rawGrid[$x][$y];
        }

        if ($x >= $this->width)
        {
            $x1 = $this->width - 1;
            $x0 = $this->width - 2;
            $y_clamped = max(0, min($y, $this->height - 1));
            $gradient = $this->rawGrid[$x1][$y_clamped] - $this->rawGrid[$x0][$y_clamped];

            return $this->rawGrid[$x1][$y_clamped] + $gradient;
        }

        if ($x < 0)
        {
            $x0 = 0;
            $x1 = 1;
            $y_clamped = max(0, min($y, $this->height - 1));
            $gradient = $this->rawGrid[$x0][$y_clamped] - $this->rawGrid[$x1][$y_clamped];

            return $this->rawGrid[$x0][$y_clamped] + $gradient;
        }

        if ($y >= $this->height)
        {
            $y1 = $this->height - 1;
            $y0 = $this->height - 2;
            $x_clamped = max(0, min($x, $this->width - 1));
            $gradient = $this->rawGrid[$x_clamped][$y1] - $this->rawGrid[$x_clamped][$y0];

            return $this->rawGrid[$x_clamped][$y1] + $gradient;
        }

        if ($y < 0)
        {
            $y0 = 0;
            $y1 = 1;
            $x_clamped = max(0, min($x, $this->width - 1));
            $gradient = $this->rawGrid[$x_clamped][$y0] - $this->rawGrid[$x_clamped][$y1];

            return $this->rawGrid[$x_clamped][$y0] + $gradient;
        }

        return 0.5;
    }

    public function render(BiomeGrid $biomeGrid)
    {
        $this->init($biomeGrid);
        $this->drawSmooth();

        return $this->image;
    }

    private function drawSmooth(): void
    {
        $imgWidth = $this->width * $this->cellSize;
        $imgHeight = $this->height * $this->cellSize;
        $cellSizeInv = 1.0 / $this->cellSize;
        $colors = $this->colors;
        $image = $this->image;
        $noiseCache = [];
        $biomeLookupTable = $this->biomeLookupTable;
        $minNoise = $this->minNoise;
        $bucketSize = $this->bucketSize;

        for ($py = 0; $py < $imgHeight; $py++)
        {
            $gridX = $py * $cellSizeInv;
            $xi = (int)$gridX;
            $xf = $gridX - $xi;
            $u = $xf * $xf * (3.0 - 2.0 * $xf);

            for ($px = 0; $px < $imgWidth; $px++)
            {
                $gridY = $px * $cellSizeInv;
                $yi = (int)$gridY;
                $yf = $gridY - $yi;

                // Use numeric cache key to avoid string concatenation
                $cacheKey = $xi * 1000 + $yi;
                if (!isset($noiseCache[$cacheKey]))
                {
                    $n00 = $this->getExtrapolatedNoiseAt($xi, $yi);
                    $n10 = $this->getExtrapolatedNoiseAt($xi + 1, $yi);
                    $n01 = $this->getExtrapolatedNoiseAt($xi, $yi + 1);
                    $n11 = $this->getExtrapolatedNoiseAt($xi + 1, $yi + 1);
                    $noiseCache[$cacheKey] = [$n00, $n10, $n01, $n11];
                }

                $cached = $noiseCache[$cacheKey];
                $n00 = $cached[0];
                $n10 = $cached[1];
                $n01 = $cached[2];
                $n11 = $cached[3];

                $v = $yf * $yf * (3.0 - 2.0 * $yf);

                $nx0 = $n00 + ($n10 - $n00) * $u;
                $nx1 = $n01 + ($n11 - $n01) * $u;
                $noiseValue = $nx0 + ($nx1 - $nx0) * $v;

                // Inline biome lookup to avoid function call
                if ($bucketSize <= 0)
                {
                    $biomeId = $biomeLookupTable[0];
                }
                else
                {
                    $index = (int)floor(($noiseValue - $minNoise) / $bucketSize);
                    $index = max(0, min($index, 999));
                    $biomeId = $biomeLookupTable[$index];
                }

                imagesetpixel($image, $px, $py, $colors[$biomeId]);
            }
        }
    }

    public function save(string $filename): void
    {
        imagepng($this->image, $filename);
    }

    public function output(): void
    {
        header('Content-Type: image/png');
        imagepng($this->image);
    }
}
