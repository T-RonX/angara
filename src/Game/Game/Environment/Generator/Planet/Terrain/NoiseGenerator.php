<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use MapGenerator\PerlinNoiseGenerator;
use SplFixedArray;
use Symfony\Component\DependencyInjection\Attribute\AutowireInline;

class NoiseGenerator
{
    public function __construct(
        #[AutowireInline(class: PerlinNoiseGenerator::class)] private readonly PerlinNoiseGenerator $perlinNoiseGenerator,
    ) {
    }

    /**
     * @return SplFixedArray<int, SplFixedArray<float>>
     */
    public function generate(MapDescriptor $mapDescriptor, ?string $seed): SplFixedArray
    {
        $this->perlinNoiseGenerator->setPersistence($mapDescriptor->getRoughness());
        $this->perlinNoiseGenerator->setSize($mapDescriptor->getSize());

        if ($seed)
        {
            $this->perlinNoiseGenerator->setMapSeed($seed);
        }

        /** @var SplFixedArray<int, SplFixedArray> $map */
        $map = $this->perlinNoiseGenerator->generate();

        return $map;
    }
}
