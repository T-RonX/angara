<?php

declare(strict_types=1);

namespace App\System\Controller;

use App\Game\Environment\Generator\Planet\Terrain\MapGenerator;
use App\Game\Game\Context\PlayerContext;
use App\Game\Game\Environment\Generator\Planet\PlanetGenerator;
use App\Game\Game\Environment\Generator\Planet\Terrain\StyleProvider;
use App\Game\Game\SendDailySalesReports;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
class HomeController // extends AbstractController
{
    #[Route('api/test', 'test')]
    public function index(
        PlayerContext $playerContext,
        MessageBusInterface $messenger,
        PlanetGenerator $planetGenerator,
        StyleProvider $styleProvider,
    ): JsonResponse
    {
        $messenger->dispatch(new SendDailySalesReports(33));

        $mapDescriptor = $styleProvider->getStyle();
//        $map = $planetGenerator->generate(null, $mapDescriptor, '/var/www/html/src/map.webp');

        $finder = (new Finder())->files()->in('/var/www/html/src/map/');
        $map = [];

        foreach ($finder as $file)
        {
            preg_match_all('#^tile_(?<y>\d+)_(?<x>\d+).webp#', $file->getFilename(), $matches);

            $map[] = [
                'x' => (int) $matches['x'][0],
                'y' => (int) $matches['y'][0],
                'data' => base64_encode(gzdeflate($file->getContents())),
            ];
        }

        return new JsonResponse(
            [
                'playerName' => $playerContext->getPlayer()->getName() . ' ('.$playerContext->getPlayer()->getUser()->getUsername() . ')',
                'map' => $map,
            ], 200, [
                'Access-Control-Allow-Origin' => '*',
        ]);
    }
}
