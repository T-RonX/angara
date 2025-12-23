<?php

declare(strict_types=1);

namespace App\System\Controller;

use App\Game\Environment\Generator\Planet\Terrain\MapGenerator;
use App\Game\Game\Context\PlayerContext;
use App\Game\Game\Environment\Generator\Planet\BodyGenerator;
use App\Game\Game\Environment\Generator\Planet\PlanetGenerator;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;
use App\Game\Game\Environment\Generator\Planet\Terrain\MapDescriptor;
use App\Game\Game\Environment\Generator\Planet\Terrain\StyleProvider;
use App\Game\Game\Environment\Generator\Planet\Terrain\Type\TerrainType;
use App\Game\Game\SendDailySalesReports;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\TerrainMap\Biome;
use App\Game\Game\SpatialEntity\SpacialEntityBuilder;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
class PublicController
{
    #[Route('public/map', 'public.map')]
    public function index(
        BodyGenerator $bodyGenerator,
        StyleProvider $styleProvider,
        SpacialEntityBuilder $spacialEntityBuilder,
    ): JsonResponse
    {
        $seed = bin2hex(random_bytes(21));
        $seed = 'a4c4ceac0e8ec397378891841b4a45aef983147a5e';
        $style = null;
        $style = 'fictional_7';

        [$mapDescriptor, $styleName] = $styleProvider->getStyle($style);
        $body = $bodyGenerator->generate($seed, $mapDescriptor);

        $terrainTypes = array_map(static fn (TerrainType $terrainType) => ['color' => $terrainType->color->toArray(), 'name' => $terrainType->getId()], $mapDescriptor->getTerrain()->getTypes());


        $bodyx = $spacialEntityBuilder->buildCelestialBody(150, $seed)
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
            ->createBorderGrid(0.02)
            ->build()
        ;

        $terrainTypesx = array_map(
            static fn (Biome $biome) => [
                'color' => $biome->color,
                'name' => $biome->name,
            ],
            $bodyx->terrainMap->biomeGrid->biomes,
        );


        return new JsonResponse(json_encode(['map' => $bodyx->terrainMap->biomeGrid->getGrid(), 'border' => $bodyx->terrainMap->borderGrid->getGrid(), 'terrainTypes' => $terrainTypesx, 'styleName' => 'build', 'seed' => $seed], JSON_THROW_ON_ERROR));
    }
}
