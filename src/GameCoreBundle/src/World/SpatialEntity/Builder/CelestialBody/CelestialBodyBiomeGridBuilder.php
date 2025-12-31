<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialEntity\Builder\CelestialBody;

use App\GameCoreBundle\World\Noise\NoiseGrid;
use App\GameCoreBundle\World\Noise\PerlinNoise\PerlinNoiseGenerator;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;

class CelestialBodyBiomeGridBuilder
{
    public function __construct(
        private readonly PerlinNoiseGenerator $noiseGenerator,
        private readonly CelestialBodyFactory $factory,
    ) {
    }

    /**
     * @param Biome[] $biomes
     */
    public function create(int $size, float $roughness, string $seed, array $biomes): BiomeGrid
    {
        $noiseGridRaw = $this->noiseGenerator->generate($size, $roughness, $seed);
        $noiseGridNormalized = $noiseGridRaw->normalize();
        $noiseGridQuantized = $this->quantizeNoiseMap($noiseGridNormalized, $biomes);

        return $this->factory->createBiomeGrid($biomes, $noiseGridRaw, $noiseGridNormalized, $noiseGridQuantized);
    }

    /**
     * Quantized the noice map to align with the give thresholds indices.
     *
     * @param Biome[] $biomes
     */
    private function quantizeNoiseMap(NoiseGrid $noiseGridNormalized, array $biomes): NoiseGrid
    {
        $newGrid = $noiseGridNormalized->clone();

        $max = count($biomes) - 1;

        foreach ($newGrid->grid as $x => $row)
        {
            foreach ($row as $y => $value)
            {
                foreach ($biomes as $i => $biome)
                {
                    if ($value < $biome->threshold)
                    {
                        $newGrid->grid[$x][$y] = $i;
                        continue 2;
                    }
                }

                $newGrid->grid[$x][$y] = $max;
            }
        }

        return $newGrid;
    }
}
