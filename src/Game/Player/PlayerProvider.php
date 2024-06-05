<?php

declare(strict_types=1);

namespace App\Game\Player;

use App\Game\Player\Entity\Player;
use App\Game\Player\Repository\PlayerRepository;
use App\User\Entity\User;

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
