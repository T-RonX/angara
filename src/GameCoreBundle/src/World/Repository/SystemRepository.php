<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Repository;

use App\GameCoreBundle\World\Entity\System;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<System>
 */
class SystemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, System::class);
    }
}

