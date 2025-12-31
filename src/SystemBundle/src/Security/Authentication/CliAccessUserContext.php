<?php

declare(strict_types=1);

namespace App\SystemBundle\Security\Authentication;

use App\SystemBundle\CliAccess\BaseCliAccessContext;
use App\SystemBundle\Exception\ItemNotFoundException;
use App\SystemBundle\User\Entity\User;
use App\SystemBundle\User\Provider\UserProvider;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

readonly class CliAccessUserContext extends BaseCliAccessContext
{
    public function __construct(
        private UserProvider $userProvider,
        private TokenStorageInterface $tokenStorage,
    ) {
    }

    public function getOptionName(): string
    {
        return 'user';
    }

    public function setContext(mixed $value): void
    {
        if ($value === null)
        {
            return;
        }

        $userId = (int) $value;
        $user = $this->userProvider->getUser($userId);

        if ($user === null)
        {
            throw new ItemNotFoundException(User::class, $value);
        }

        $token = new IdToken($user->getRoles());
        $token->setUser($user);

        $this->tokenStorage->setToken($token);
    }
}
