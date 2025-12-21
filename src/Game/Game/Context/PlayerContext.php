<?php

declare(strict_types=1);

namespace App\Game\Game\Context;

use App\Game\Context\NoUserInContextException;
use App\Game\Game\Player\Entity\Player;
use App\Game\Game\Player\PlayerProvider;
use App\System\User\Entity\User;
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
