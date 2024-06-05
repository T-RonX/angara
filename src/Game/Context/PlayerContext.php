<?php

declare(strict_types=1);

namespace App\Game\Context;

use App\Context\NoUserInContextException;
use App\Game\Player\Entity\Player;
use App\Game\Player\PlayerProvider;
use App\User\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;

readonly class PlayerContext
{
    public function __construct(
        private Security $security,
        private PlayerProvider $playerProvider,
    ) {
    }

    public function getPlayer(): Player
    {
        $this->validateUser();

        /** @var User $user */
        $user = $this->security->getUser();

        return current($this->playerProvider->getUserPlayers($user));
    }

    private function validateUser(): void
    {
        if (!$this->security->getUser())
        {
            throw new NoUserInContextException();
        }
    }
}
