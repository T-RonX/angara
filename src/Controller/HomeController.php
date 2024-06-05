<?php

declare(strict_types=1);

namespace App\Controller;

use App\Game\Context\PlayerContext;
use App\Game\Player\Entity\Player;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class HomeController extends AbstractController
{
    #[Route('api/test', 'test')]
    public function index(PlayerContext $playerContext): JsonResponse
    {
        return new JsonResponse(
            [
                'playerName' => $playerContext->getPlayer()->getName() . ' ('.$playerContext->getPlayer()->getUser()->getUsername() . ')'
            ]);
    }
}
