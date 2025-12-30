<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialEntity\Builder\CelestialBody;

use App\Game\Game\World\Noise\SeedGenerator;
use App\Game\Game\World\SpatialEntity\SpacialEntityBuilder;

class CelestialBodyBuilderPreset
{
    /**
     * @var CelestialBodyBuilder[]|null
     */
    private array|null $builders = [];

    public function __construct(
        private readonly SpacialEntityBuilder $spacialEntityBuilder,
        private readonly SeedGenerator $seedGenerator,
    ) {
    }

    public function initializeBuilders(): void
    {
        $this->builders['style_1'] = $this->spacialEntityBuilder->buildCelestialBody(150, null)
            ->setLocation(1, 1)
            ->addBiome(0.35, 'water', '1e311f')
            ->addBiome(0.85, 'land', 'ba8c2d')
            ->addBiome(null, 'mountain', '563f17')
            ->setBiomeGrid(.81)
            ->createBorderGrid(0.035);

        $this->builders['style_2'] = $this->spacialEntityBuilder->buildCelestialBody(150, null)
            ->setLocation(1, 1)
            ->addBiome(0.25, 'water', '1f0903')
            ->addBiome(0.25, 'water', '1f0903')
            ->addBiome(0.35, 'land', 'b02507')
            ->addBiome(null, 'mountain', 'f5bd5a')
            ->setBiomeGrid(.82)
            ->createBorderGrid(0.035);

        $this->builders['style_3'] = $this->spacialEntityBuilder->buildCelestialBody(150, null)
            ->setLocation(1, 1)
            ->addBiome(0.12, 'water', '00102d')
            ->addBiome(0.26, 'water', '045289')
            ->addBiome(0.3, 'water', '056eba')
            ->addBiome(0.7, 'land', 'd0cedd')
            ->addBiome(null, 'mountain', 'cfe1db')
            ->setBiomeGrid(.62)
            ->createBorderGrid(0.035);

        $this->builders['style_4'] = $this->spacialEntityBuilder->buildCelestialBody(150, null)
            ->setLocation(1, 1)
            ->addBiome(0.35, 'water', '364653')
            ->addBiome(0.53, 'land', '7eaa5c')
            ->addBiome(0.57, 'land', 'c4bb44')
            ->addBiome(0.75, 'land', '94b76e')
            ->addBiome(null, 'mountain', '787536')
            ->setBiomeGrid(.50)
            ->createBorderGrid(0.035);

        $this->builders['style_5'] = $this->spacialEntityBuilder->buildCelestialBody(150, null)
            ->setLocation(1, 1)
            ->addBiome(0.46, 'water', 'c48787')
            ->addBiome(0.462, 'land', '87c49a')
            ->addBiome(0.463, 'land', 'c527f5')
            ->addBiome(0.8, 'land', 'b687c4')
            ->addBiome(null, 'mountain', '87abc4')
            ->setBiomeGrid(.9)
            ->createBorderGrid(0.02);

        $this->builders['style_6'] = $this->spacialEntityBuilder->buildCelestialBody(22, null)
            ->setLocation(1, 1)
            ->addBiome(0.1, 'water', '104b06')
            ->addBiome(0.2, 'land', '524702')
            ->addBiome(0.3, 'land', 'debf2d')
            ->addBiome(0.4, 'land', 'bec832')
            ->addBiome(0.5, 'mountain', '4f280f')
            ->addBiome(0.6, 'mountain', 'dae44b')
            ->addBiome(0.7, 'mountain', '7a351c')
            ->addBiome(0.8, 'mountain', '23380e')
            ->addBiome(null, 'mountain', '1a0c01')
            ->setBiomeGrid(.8)
            ->createBorderGrid(0.02);

        $this->builders['style_7'] = $this->spacialEntityBuilder->buildCelestialBody(10, null)
            ->setLocation(1, 1)
            ->addBiome(0.5, 'water', '454545')
            ->addBiome(null, 'land', '1c1c1c')
            ->setBiomeGrid(.7)
            ->createBorderGrid(0.04);
    }

    public function getBuilder(string|null $presetName = null, string|null $seed = null): CelestialBodyBuilder
    {
        $this->initializeBuilders();

        if ($presetName === null)
        {
            $builderNames = array_keys($this->builders);
            $builderName = $builderNames[random_int(0, count($builderNames) - 1)];
            $builder = $this->builders[$builderName];
        }
        else
        {
            $builder = $this->builders[$presetName];

        }

        if ($seed === null)
        {
            $seed = $this->seedGenerator->createSeed();
        }

        return $builder->setSeed($seed);
    }
}
