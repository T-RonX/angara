<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity\Builder\CelestialBody;

use App\Game\Game\SpatialGrid\SpatialGrid;
use App\Game\Game\SpatialEntity\Coordinate;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\CelestialBody;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\BiomeGrid;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\BorderGrid;
use App\Game\Game\SpatialEntity\SpacialEntityFactory;
use Symfony\Component\DependencyInjection\Attribute\Autoconfigure;

#[Autoconfigure(shared: false)]
class CelestialBodyBuilder
{
    private string|null $seed;
    private int $size;
    private float $roughness;
    private float $borderThreshold;
    private Coordinate $location;
    /** @var Biome[]  */
    private array $biomes;
    private BiomeGrid $biomeGrid;
    private BorderGrid $borderGrid;
//    private SpatialGrid $resourceGrid;

    public function __construct(
        private readonly SpacialEntityFactory $spacialEntityFactory,
        private readonly CelestialBodyFactory $celestialBodyFactory,
        private readonly CelestialBodyBiomeGridBuilder $biomeGridBuilder,
        private readonly CelestialBodyBorderGridBuilder $borderGridBuilder,
    ) {
    }

    public function setSeed(string|null $seed): static
    {
        $this->seed = $seed;

        return $this;
    }

    public function setLocation(int $x, int $y): static
    {
        $this->location = $this->spacialEntityFactory->createCoordinate($x, $y);

        return $this;
    }

    public function setSize(int $size): static
    {
        $this->size = $size;

        return $this;
    }

    public function addBiome(float|null $threshold, string $name, string $color): static
    {
        $this->biomes[] = $this->celestialBodyFactory->createBiome($threshold, $name, $color);

        return $this;
    }

    public function setBiomeGrid(float $roughness): static
    {
        $this->roughness = $roughness;

        return $this;
    }

    public function createBorderGrid(float $threshold): static
    {
        $this->borderThreshold = $threshold;

        return $this;
    }

    public function build(): CelestialBody
    {
        $this->biomeGrid = $this->biomeGridBuilder->create($this->size, $this->roughness, $this->seed, $this->biomes);
        $this->borderGrid = $this->borderGridBuilder->create($this->biomeGrid, $this->biomes, $this->borderThreshold);

        $terrainMap = $this->celestialBodyFactory->createTerrainMap(
            $this->biomeGrid,
            $this->borderGrid,
//            $this->resourceGrid,
        );

        return $this->celestialBodyFactory->createCelestialBody($this->location, $terrainMap);
    }
}
