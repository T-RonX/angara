<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Tick\Evolution\ResourceStateChange;
use App\GameCoreBundle\Economy\Tick\Evolution\ResourceStateWriter;
use App\GameCoreBundle\Economy\Tick\Evolution\StateEvolver;
use App\GameCoreBundle\Economy\Tick\Exception\WorldNotFoundException;
use App\GameCoreBundle\Economy\Tick\Input\WorldEconomyReader;
use App\GameCoreBundle\Economy\Tick\Report\BodyResourceState;
use App\GameCoreBundle\Economy\Tick\Report\ResourceFlow;
use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use App\GameCoreBundle\Economy\Tick\State\EconomyStateWriter;
use Doctrine\DBAL\Connection;

/**
 * Use-case orchestration of a single economy tick: load a world, calculate the
 * GameFlow result, evolve the persistent state and refresh the current-state read
 * model. This is the entry point a scheduled command (or message handler) drives.
 *
 * The whole path is set-based and ORM-free. The world's resources are streamed
 * one system at a time via {@see WorldEconomyReader} (rather than lazy-loading
 * each body's resource collection one query at a time, or buffering the whole
 * world), and the evolved state and read model are written in bulk via DBAL inside
 * a single transaction. The tick runs in two streaming passes over that same input:
 *
 *  1. Aggregation: {@see TickCalculator} folds the row stream into the small,
 *     bounded report aggregates and pushes the large per-body states and flows
 *     straight to the read-model writer (and, when {@code $collectDetail} is set,
 *     also into the report for rendering).
 *  2. Evolution: {@see StateEvolver} re-streams the input and, using the global
 *     pressure distribution computed in pass 1, writes each resource's next-tick
 *     reserves and stock back in bulk.
 *
 * Touching no managed entities means there is no UnitOfWork to flush and no stale
 * graph to clear, and streaming both passes means peak memory stays O(systems x
 * materials) — flat as the universe grows to hundreds of systems and bodies.
 */
final class EconomyTicker
{
    public function __construct(
        private readonly WorldEconomyReader $worldEconomyReader,
        private readonly Connection $connection,
        private readonly TickCalculator $tickCalculator,
        private readonly StateEvolver $stateEvolver,
        private readonly ResourceStateWriter $resourceStateWriter,
        private readonly EconomyStateWriter $stateWriter,
    ) {
    }

    /**
     * @param bool $collectDetail when true, the per-body states and flows are also
     *                            retained on the returned report for rendering; at
     *                            scale leave this off so the tick never holds an
     *                            O(resources) graph in memory
     *
     * @throws WorldNotFoundException
     */
    public function tick(string $worldIdentifier, bool $collectDetail = false): TickReport
    {
        $world = $this->worldEconomyReader->findWorld($worldIdentifier);

        if ($world === null)
        {
            throw WorldNotFoundException::withIdentifier($worldIdentifier);
        }

        $worldId = $world->id;
        $tick = $world->tick + 1;
        $report = new TickReport($tick, $worldIdentifier);

        $bodyStateSink = function (BodyResourceState $state) use ($report, $collectDetail): void
        {
            $this->stateWriter->addBodyState($state);

            if ($collectDetail)
            {
                $report->addBodyState($state);
            }
        };

        $flowSink = function (ResourceFlow $flow) use ($report, $collectDetail): void
        {
            $this->stateWriter->addFlow($flow);

            if ($collectDetail)
            {
                $report->addFlow($flow);
            }
        };

        $this->connection->transactional(function () use ($worldId, $tick, $report, $bodyStateSink, $flowSink): void
        {
            $this->stateWriter->reset($worldId, $tick);
            $this->tickCalculator->aggregate(
                $report,
                $this->worldEconomyReader->streamResourceRows($worldId),
                $bodyStateSink,
                $flowSink,
            );
            $this->stateWriter->writeAggregates($report);
            $this->stateWriter->flush();

            $this->resourceStateWriter->reset();
            $changeSink = function (ResourceStateChange $change): void
            {
                $this->resourceStateWriter->add($change);
            };
            $this->stateEvolver->streamChanges(
                $this->worldEconomyReader->streamResourceRows($worldId),
                $report->pressureDistribution,
                $changeSink,
            );
            $this->resourceStateWriter->flush();

            $this->connection->update('world', ['tick' => $tick], ['id' => $worldId]);
        });

        return $report;
    }
}
