<?php

declare(strict_types=1);

namespace App\Game\Context;

use App\System\User\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;

readonly class UserContext
{
    public function __construct(
        private Security $security,
    ) {
    }

    public function hasUser(): bool
    {
        return $this->security->getUser() !== null;
    }

    public function getUser(): User
    {
        $this->validateUser();

        /** @var User $user */
        $user = $this->security->getUser();

        return $user;
    }

    private function validateUser(): void
    {
        if (!$this->security->getUser())
        {
            throw new NoUserInContextException();
        }
    }
}
