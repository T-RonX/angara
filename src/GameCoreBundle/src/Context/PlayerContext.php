<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Context;

use App\GameCoreBundle\Player\Entity\Player;
use App\GameCoreBundle\Player\PlayerProvider;
use App\SystemBundle\User\Entity\User;
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
