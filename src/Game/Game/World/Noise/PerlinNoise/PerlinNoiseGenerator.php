<?php

declare(strict_types=1);

namespace App\Game\Game\World\Noise\PerlinNoise;

use App\Game\Game\World\Noise\NoiseGrid;
use MapGenerator\PerlinNoiseGenerator as MapGeneratorPerlinNoiseGenerator;
use SplFixedArray;
use Symfony\Component\DependencyInjection\Attribute\AutowireInline;

class PerlinNoiseGenerator
{
    public function __construct(
        #[AutowireInline(class: MapGeneratorPerlinNoiseGenerator::class)] private readonly MapGeneratorPerlinNoiseGenerator $perlinNoiseGenerator,
    ) {
    }

    public function generate(int $size, float $persistence, ?string $seed): NoiseGrid
    {
        $this->perlinNoiseGenerator->setSize($size);
        $this->perlinNoiseGenerator->setPersistence($persistence);

        if ($seed)
        {
            $this->perlinNoiseGenerator->setMapSeed($seed);
        }

        /** @var SplFixedArray<int, SplFixedArray<int, float>> $noise */
        $noise = $this->perlinNoiseGenerator->generate();

        return new NoiseGrid($noise);
    }
}
