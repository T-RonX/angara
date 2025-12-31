<?php

declare(strict_types=1);

namespace App\SystemBundle\Controller;

use App\Game\Environment\Generator\Planet\Terrain\MapGenerator;
use App\Game\Game\Environment\Generator\Planet\PlanetGenerator;
use App\Game\Game\SendDailySalesReports;
use App\Game\Game\World\SpatialEntity\Builder\CelestialBody\StyleProvider;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
class IndexController extends AbstractController
{
    #[Route('/', 'index')]
    public function index(): Response
    {
        return $this->render('index/index.html.twig');
    }
}
