<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Repository;

use App\GameCoreBundle\World\Entity\CelestialBody;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CelestialBody>
 */
class CelestialBodyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CelestialBody::class);
    }
}

