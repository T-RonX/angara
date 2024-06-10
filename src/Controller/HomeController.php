<?php

declare(strict_types=1);

namespace App\Controller;

use App\Game\Context\PlayerContext;
use App\Game\SendDailySalesReports;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
class HomeController // extends AbstractController
{
    #[Route('api/test', 'test')]
    public function index(PlayerContext $playerContext, MessageBusInterface $messenger): JsonResponse
    {
        $messenger->dispatch(new SendDailySalesReports(33));

        return new JsonResponse(
            [
                'playerName' => $playerContext->getPlayer()->getName() . ' ('.$playerContext->getPlayer()->getUser()->getUsername() . ')'
            ]);
    }
}
