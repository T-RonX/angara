<?php

declare(strict_types=1);

namespace App\User\Repository;

use App\User\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class UserRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function usernameExists(string $username): bool
    {
        return null !== $this->createQueryBuilder('u')
                ->select('IDENTITY(u)')
                ->where('u.username = :username')
                ->setParameter('username', $username)
                ->getQuery()
                ->getSingleScalarResult();
    }
}