<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Player;

use App\GameCoreBundle\Player\Entity\Player;
use App\GameCoreBundle\Player\Repository\PlayerRepository;
use App\SystemBundle\User\Entity\User;

class PlayerProvider
{
    public function __construct(
        private PlayerRepository $playerRepository
    ) {
    }

    /**
     * @return Player[]
     */
    public function getUserPlayers(User $user): array
    {
        return $this->playerRepository->findBy(['user' => $user]);
    }
}
