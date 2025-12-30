<?php

declare(strict_types=1);

namespace App\System\Controller;

use App\Game\Game\World\SpatialEntity\Builder\CelestialBody\CelestialBodyBuilderPreset;
use App\Game\Game\World\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\Game\Game\World\SpatialEntity\SpacialEntityBuilder;
use App\System\Controller\TerrainRenderer;
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
        $seed = '8139216bdbdc237bd3f7a82f935c64aa7099ad6f42';
        $body = $celestialBodyBuilderPreset->getBuilder('style_6', $seed)->build();

        $terrainTypes = array_map(
            static fn (Biome $biome): array => [
                'color' => $biome->color,
                'name' => $biome->name,
            ],
            $body->terrainMap->biomeGrid->biomes,
        );


        // Render and output
        $image = $this->terrainRenderer->render($body->terrainMap->biomeGrid);
        $this->terrainRenderer->save('/var/www/html/tmp/terrain.png');
        $this->terrainRenderer->output();
        exit;

        return new JsonResponse(
            json_encode([
                    'map' => $body->terrainMap->biomeGrid->getGrid(),
                    'border' => $body->terrainMap->borderGrid->getGrid(),
                    'terrainTypes' => $terrainTypes,
                    'styleName' => 'build',
                    'seed' => $seed
                ],
                JSON_THROW_ON_ERROR,
            )
        );
    }
}


