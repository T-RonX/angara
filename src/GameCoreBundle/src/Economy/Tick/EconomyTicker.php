<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Tick\Exception\WorldNotFoundException;
use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use App\GameCoreBundle\World\Repository\WorldRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Use-case orchestration of a single economy tick: load a world, calculate the
 * GameFlow result, evolve the persistent state and flush. This is the entry
 * point a scheduled command (or message handler) drives.
 */
final class EconomyTicker
{
    public function __construct(
        private readonly WorldRepository $worldRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly TickCalculator $tickCalculator,
        private readonly StateEvolver $stateEvolver,
    ) {
    }

    /**
     * @throws WorldNotFoundException
     */
    public function tick(string $worldIdentifier): TickReport
    {
        $world = $this->worldRepository->findOneByIdentifier($worldIdentifier);

        if ($world === null)
        {
            throw WorldNotFoundException::withIdentifier($worldIdentifier);
        }

        $tick = $world->getTick() + 1;

        $report = $this->tickCalculator->calculate($world, $tick);
        $this->stateEvolver->apply($world, $report);
        $world->setTick($tick);

        $this->entityManager->flush();

        return $report;
    }
}

