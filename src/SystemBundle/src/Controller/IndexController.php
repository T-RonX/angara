<?php

declare(strict_types=1);

namespace App\SystemBundle\Controller;

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
        return $this->render('index/index.html.twig', [
            'bodySeeds' => [
                'id' => 'primary',
                'seed' => 1337,
                'companions' => [
                    [
                        'id' => 'moon-1',
                        'seed' => 4242,
                        'companions' => [],
                    ],
                    [
                        'id' => 'satellite-1',
                        'seed' => 9876,
                        'companions' => [],
                    ],
                    [
                        'id' => 'satellite-2',
                        'seed' => 1111,
                        'companions' => [],
                    ],
                ],
            ],
        ]);
    }
}
