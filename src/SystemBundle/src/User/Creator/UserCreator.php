<?php

declare(strict_types=1);

namespace App\SystemBundle\User\Creator;

use App\SystemBundle\User\Entity\User;
use App\SystemBundle\User\Provider\UserProvider;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

readonly class UserCreator
{
    public function __construct(
        private UserProvider $provider,
        private UserPasswordHasherInterface $passwordHasher,
        private EntityManagerInterface$entityManager,
    ) {
    }

    public function create(string $username, string $password): User
    {
        $user = $this->provider->createNewUser();
        $user->setUsername($username);
        $user->setPassword($this->passwordHasher->hashPassword($user, $password));

        $this->entityManager->persist($user);

        return $user;
    }
}
