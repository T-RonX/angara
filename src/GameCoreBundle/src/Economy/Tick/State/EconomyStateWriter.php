<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State;

use App\GameCoreBundle\Economy\Tick\Report\BodyResourceState;
use App\GameCoreBundle\Economy\Tick\Report\ResourceFlow;
use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use Doctrine\DBAL\Connection;

/**
 * Persists a tick into the current-state read model as a streaming sink (DBAL, no
 * UnitOfWork). The two large tables (body states, flows) are fed row by row via
 * {@see addBodyState} / {@see addFlow} and flushed in bounded multi-row INSERT
 * batches, so the writer never materializes an O(resources) array. The small,
 * bounded aggregates are written in one shot by {@see writeAggregates}.
 *
 * {@see reset} first deletes the world's existing rows from every table, so the
 * model keeps only the latest tick per world. Must be driven inside a transaction
 * owned by the caller, together with the resource state write-back, so a tick is
 * committed atomically and readers never observe a half-replaced world.
 */
final class EconomyStateWriter
{
    private const int BATCH_SIZE = 1000;

    private const array TABLES = [
        'current_body_resource_state',
        'current_system_resource_summary',
        'current_global_resource_pressure',
        'current_resource_flow',
        'current_component_cost',
    ];

    private int $worldId = 0;

    private int $tick = 0;

    /** @var list<list<mixed>> */
    private array $bodyBatch = [];

    /** @var list<list<mixed>> */
    private array $flowBatch = [];

    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    public function reset(int $worldId, int $tick): void
    {
        $this->worldId = $worldId;
        $this->tick = $tick;
        $this->bodyBatch = [];
        $this->flowBatch = [];

        foreach (self::TABLES as $table)
        {
            $this->connection->delete($table, ['world_id' => $worldId]);
        }
    }

    public function addBodyState(BodyResourceState $state): void
    {
        $this->bodyBatch[] = [
            $this->worldId,
            $this->tick,
            $state->systemIdentifier,
            $state->bodyIdentifier,
            $state->materialIdentifier,
            $state->physicalSupply,
            $state->depletionRate,
            $state->ticksLeft,
            $state->decayedStock,
            $state->supply,
            $state->demand,
            $state->surplus,
            $state->deficit,
            $state->imbalance,
            $state->ticksToFullOrEmpty,
        ];

        if (count($this->bodyBatch) >= self::BATCH_SIZE)
        {
            $this->flushBodyStates();
        }
    }

    public function addFlow(ResourceFlow $flow): void
    {
        $this->flowBatch[] = [
            $this->worldId,
            $this->tick,
            $flow->scope->value,
            $flow->materialIdentifier,
            $flow->fromIdentifier,
            $flow->toIdentifier,
            $flow->amount,
        ];

        if (count($this->flowBatch) >= self::BATCH_SIZE)
        {
            $this->flushFlows();
        }
    }

    public function writeAggregates(TickReport $report): void
    {
        $this->writeSystemSummaries($report);
        $this->writePressures($report);
        $this->writeComponentCosts($report);
    }

    public function flush(): void
    {
        $this->flushBodyStates();
        $this->flushFlows();
    }

    private function writeSystemSummaries(TickReport $report): void
    {
        $rows = [];

        foreach ($report->systemSummaries as $summary)
        {
            $rows[] = [
                $this->worldId,
                $this->tick,
                $summary->systemIdentifier,
                $summary->materialIdentifier,
                $summary->supply,
                $summary->demand,
                $summary->imbalance,
                $summary->localScarcityIndex,
                $summary->localPrice,
            ];
        }

        $this->bulkInsert('current_system_resource_summary', [
            'world_id',
            'tick',
            'system_identifier',
            'material_identifier',
            'supply',
            'demand',
            'imbalance',
            'local_scarcity_index',
            'local_price',
        ], $rows);
    }

    private function writePressures(TickReport $report): void
    {
        $rows = [];

        foreach ($report->pressures as $pressure)
        {
            $rows[] = [
                $this->worldId,
                $this->tick,
                $pressure->materialIdentifier,
                $pressure->totalSupply,
                $pressure->totalDemand,
                $pressure->totalImbalance,
                $pressure->scarcityIndex,
                $pressure->desiredScarcityIndex,
                $pressure->pressure,
                $pressure->nudge,
                $pressure->introduce,
                $pressure->expire,
            ];
        }

        $this->bulkInsert('current_global_resource_pressure', [
            'world_id',
            'tick',
            'material_identifier',
            'total_supply',
            'total_demand',
            'total_imbalance',
            'scarcity_index',
            'desired_scarcity_index',
            'pressure',
            'nudge',
            'introduce',
            'expire',
        ], $rows);
    }

    private function writeComponentCosts(TickReport $report): void
    {
        $rows = [];

        foreach ($report->componentCosts as $key => $cost)
        {
            [$systemIdentifier, $componentIdentifier] = explode(':', $key, 2);

            $rows[] = [
                $this->worldId,
                $this->tick,
                $systemIdentifier,
                $componentIdentifier,
                $cost,
            ];
        }

        $this->bulkInsert('current_component_cost', [
            'world_id',
            'tick',
            'system_identifier',
            'component_identifier',
            'cost',
        ], $rows);
    }

    private function flushBodyStates(): void
    {
        $this->bulkInsert('current_body_resource_state', [
            'world_id',
            'tick',
            'system_identifier',
            'body_identifier',
            'material_identifier',
            'physical_supply',
            'depletion_rate',
            'ticks_left',
            'decayed_stock',
            'supply',
            'demand',
            'surplus',
            'deficit',
            'imbalance',
            'ticks_to_full_or_empty',
        ], $this->bodyBatch);

        $this->bodyBatch = [];
    }

    private function flushFlows(): void
    {
        $this->bulkInsert('current_resource_flow', [
            'world_id',
            'tick',
            'scope',
            'material_identifier',
            'from_identifier',
            'to_identifier',
            'amount',
        ], $this->flowBatch);

        $this->flowBatch = [];
    }

    /**
     * @param string[] $columns
     * @param list<list<mixed>> $rows
     */
    private function bulkInsert(string $table, array $columns, array $rows): void
    {
        if ($rows === [])
        {
            return;
        }

        $columnSql = implode(', ', $columns);

        foreach (array_chunk($rows, self::BATCH_SIZE) as $chunk)
        {
            $placeholders = [];
            $params = [];

            foreach ($chunk as $row)
            {
                $placeholders[] = '(' . implode(', ', array_fill(0, count($row), '?')) . ')';

                foreach ($row as $value)
                {
                    $params[] = $value;
                }
            }

            $sql = sprintf(
                'INSERT INTO %s (%s) VALUES %s',
                $table,
                $columnSql,
                implode(', ', $placeholders),
            );

            $this->connection->executeStatement($sql, $params);
        }
    }
}
