<?php

declare(strict_types=1);

namespace App\SystemBundle\Controller;

use App\GameCoreBundle\World\SpatialEntity\Builder\CelestialBody\CelestialBodyBuilderPreset;
use App\GameCoreBundle\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\GameCoreBundle\World\SpatialEntity\SpacialEntityBuilder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
class PublicController
{
    public function __construct(private readonly TerrainRenderer $terrainRenderer)
    {
    }

    #[Route('public/map', 'public.map')]
    public function index(
        CelestialBodyBuilderPreset $celestialBodyBuilderPreset,
        SpacialEntityBuilder $spacialEntityBuilder,
        TerrainRenderer $renderer,
    ): JsonResponse
    {
        $style = 'style_3';
        $seed = '8139216bdbdc237bd3f7a82f935c64aa7099ad6f44';
        $body = $celestialBodyBuilderPreset->getBuilder($style, $seed)->build();

        $terrainTypes = array_map(
            static fn (Biome $biome): array => [
                'color' => $biome->color,
                'name' => $biome->name,
            ],
            $body->terrainMap->biomeGrid->biomes,
        );


        // Render and output
//        $this->terrainRenderer->setTileDimension(256);
//        $image = $this->terrainRenderer->renderAndSaveTiles($body->terrainMap->biomeGrid, '/var/www/html/tmp/map');
//        exit;

        return new JsonResponse(
            json_encode([
                    'map' => $body->terrainMap->biomeGrid->getGrid(),
                    'border' => $body->terrainMap->borderGrid->getGrid(),
                    'terrainTypes' => $terrainTypes,
                    'styleName' => $style,
                    'seed' => $seed
                ],
                JSON_THROW_ON_ERROR,
            )
        );
    }
}


