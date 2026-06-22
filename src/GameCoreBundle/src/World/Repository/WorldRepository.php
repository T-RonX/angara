<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Repository;

use App\GameCoreBundle\World\Entity\World;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<World>
 */
class WorldRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, World::class);
    }

    public function findOneByIdentifier(string $identifier): ?World
    {
        return $this->findOneBy(['identifier' => $identifier]);
    }
}

