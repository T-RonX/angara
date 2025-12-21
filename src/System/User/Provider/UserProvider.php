<?php

declare(strict_types=1);

namespace App\System\User\Provider;

use App\System\Exception\ItemNotFoundException;
use App\System\User\Entity\User;
use App\System\User\Repository\UserRepository;

class UserProvider
{
    public function __construct(
        private readonly UserRepository $repository,
    ) {
    }

    public function userExists(string $username): bool
    {
        return $this->repository->usernameExists($username);
    }

    public function createNewUser(): User
    {
        return new User();
    }

    public function getUser(int $userId): ?User
    {
        return $this->repository->find($userId);
    }

    public function resolveUser(User|int $item): User
    {
        $user = $item instanceof User ? $item : $this->getUser($item);

        if ($user === null)
        {
            throw new ItemNotFoundException(User::class, (string) $item);
        }

        return $user;
    }
}
