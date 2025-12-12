<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet;

use App\Game\Environment\Generator\Planet\Terrain\MapDescriptor;
use App\Game\Environment\Generator\Planet\Terrain\TerrainGenerator;
use App\Game\Environment\Generator\Planet\Terrain\NoiseGenerator;
use App\Game\Environment\Generator\Planet\Terrain\TerrainRegionDetector;
use App\Game\Environment\Generator\Planet\Thumbnail\ThumbnailGenerator;
use App\Game\Environment\Generator\Planet\Tiling\TerrainTiler;

class PlanetGenerator
{
    public function __construct(
        private readonly NoiseGenerator $noiseGenerator,
        private readonly TerrainGenerator $terrainGenerator,
        private readonly TerrainRegionDetector $terrainRegionDetector,
        private readonly TerrainTiler $terrainTiler,
        private readonly ThumbnailGenerator $thumbnailGenerator,
    ) {
    }

    public function generate(?string $seed, MapDescriptor $mapDescriptor, string $targetFile, bool $thumbnail = true): array
    {
        ini_set('memory_limit', '-1');

        $noise = $this->noiseGenerator->generate($mapDescriptor, $seed);


        $terrain = $this->terrainGenerator->generate($mapDescriptor, $mapDescriptor->getSize(), $noise, $targetFile);
        $regions = $this->terrainRegionDetector->detect($terrain);

        $this->terrainTiler->tile($mapDescriptor, $terrain, 50, 15);

        if ($thumbnail === true)
        {
            $this->thumbnailGenerator->generate($targetFile, $this->createThumbnailPath($targetFile), $mapDescriptor->getSize());
        }

        return $terrain;
    }

    private function createThumbnailPath(string $planetFile): string
    {
        return dirname($planetFile) . '/' . preg_replace('#(\.)#', '_thumbnail$1', basename($planetFile));
    }
}
