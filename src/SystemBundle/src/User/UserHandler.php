<?php

declare(strict_types=1);

namespace App\SystemBundle\User;

use App\SystemBundle\CliAccess\CliAccessInterface;
use App\Task\Entity\Task;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\AsTaggedItem;

#[AsTaggedItem('user')]
readonly class UserHandler implements CliAccessInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function register(string $username, string $password): Task
    {
        return $this->entityManager->wrapInTransaction(function() use($name): Task {
            return $this->registar->create($name);
        });
    }
}
