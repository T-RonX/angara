<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use MapGenerator\PerlinNoiseGenerator;
use SplFixedArray;
use Symfony\Component\DependencyInjection\Attribute\AutowireInline;

class ResourceMapGenerator
{
    public function __construct(
        #[AutowireInline(class: PerlinNoiseGenerator::class)] private readonly PerlinNoiseGenerator $perlinNoiseGenerator,
    ) {
    }

    /**
     * @return SplFixedArray<int, SplFixedArray<float>>
     */
    public function generate(int $size, float $roughness, float $cutoff, ?string $seed): SplFixedArray
    {
        $this->perlinNoiseGenerator->setPersistence($roughness);
        $this->perlinNoiseGenerator->setSize($size);

        if ($seed)
        {
            $this->perlinNoiseGenerator->setMapSeed($seed);
        }

        /** @var SplFixedArray<int, SplFixedArray> $map */
        $map = $this->perlinNoiseGenerator->generate();



        $resourceMap = $this->findPeaks($map, 0.1);


        return $resourceMap;
    }

    /**
     * @param float $threshold
     *
     * @return SplFixedArray<int, SplFixedArray<float|null>>
     */
    private function findPeaks(SplFixedArray $noiseMap, float $threshold): SplFixedArray
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
                if ((($max - $value) > $threshold))
                {
                    $newMap[$x][$y] = null;
                }
                else
                {
                    $x = 1;
                }
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
