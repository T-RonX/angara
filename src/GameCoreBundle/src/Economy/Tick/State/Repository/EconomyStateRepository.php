<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Repository;

use App\GameCoreBundle\Economy\Tick\State\Entity\CurrentBodyResourceState;
use App\GameCoreBundle\Economy\Tick\State\Entity\CurrentComponentCost;
use App\GameCoreBundle\Economy\Tick\State\Entity\CurrentGlobalResourcePressure;
use App\GameCoreBundle\Economy\Tick\State\Entity\CurrentResourceFlow;
use App\GameCoreBundle\Economy\Tick\State\Entity\CurrentSystemResourceSummary;
use App\GameCoreBundle\World\Entity\World;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Read facade over the current-state economy read model. Every table holds exactly
 * the latest tick per world, so these lookups are simple equality scans on
 * world_id and need no tick filtering.
 *
 * @extends ServiceEntityRepository<CurrentBodyResourceState>
 */
class EconomyStateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CurrentBodyResourceState::class);
    }

    /**
     * @return CurrentBodyResourceState[]
     */
    public function findBodyStates(World $world): array
    {
        return $this->findBy(
            ['world' => $world],
            ['systemIdentifier' => 'ASC', 'bodyIdentifier' => 'ASC', 'materialIdentifier' => 'ASC'],
        );
    }

    /**
     * @return CurrentBodyResourceState[]
     */
    public function findBodyStatesForSystem(World $world, string $systemIdentifier): array
    {
        return $this->findBy(
            ['world' => $world, 'systemIdentifier' => $systemIdentifier],
            ['bodyIdentifier' => 'ASC', 'materialIdentifier' => 'ASC'],
        );
    }

    /**
     * @return CurrentSystemResourceSummary[]
     */
    public function findSystemSummaries(World $world): array
    {
        return $this->getEntityManager()
            ->getRepository(CurrentSystemResourceSummary::class)
            ->findBy(
                ['world' => $world],
                ['systemIdentifier' => 'ASC', 'materialIdentifier' => 'ASC'],
            );
    }

    /**
     * @return CurrentGlobalResourcePressure[]
     */
    public function findGlobalPressures(World $world): array
    {
        return $this->getEntityManager()
            ->getRepository(CurrentGlobalResourcePressure::class)
            ->findBy(
                ['world' => $world],
                ['materialIdentifier' => 'ASC'],
            );
    }

    /**
     * @return CurrentResourceFlow[]
     */
    public function findResourceFlows(World $world): array
    {
        return $this->getEntityManager()
            ->getRepository(CurrentResourceFlow::class)
            ->findBy(
                ['world' => $world],
                ['materialIdentifier' => 'ASC'],
            );
    }

    /**
     * @return CurrentComponentCost[]
     */
    public function findComponentCosts(World $world): array
    {
        return $this->getEntityManager()
            ->getRepository(CurrentComponentCost::class)
            ->findBy(
                ['world' => $world],
                ['systemIdentifier' => 'ASC', 'componentIdentifier' => 'ASC'],
            );
    }
}
