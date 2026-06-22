<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Repository;

use App\GameCoreBundle\World\Entity\CelestialBodyResource;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CelestialBodyResource>
 */
class CelestialBodyResourceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CelestialBodyResource::class);
    }
}

