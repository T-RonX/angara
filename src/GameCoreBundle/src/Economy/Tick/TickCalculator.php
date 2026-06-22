<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Calculation\ComponentCostCalculator;
use App\GameCoreBundle\Economy\Calculation\DistributionCalculator;
use App\GameCoreBundle\Economy\Calculation\PressureCalculator;
use App\GameCoreBundle\Economy\Calculation\SystemSummaryCalculator;
use App\GameCoreBundle\Economy\Material\Materials;
use App\GameCoreBundle\Economy\Material\PricedMaterialInterface;
use App\GameCoreBundle\Economy\Tick\Aggregation\MaterialPressure;
use App\GameCoreBundle\Economy\Tick\Computation\ResourceTickComputer;
use App\GameCoreBundle\Economy\Tick\Input\ResourceTickRow;
use App\GameCoreBundle\Economy\Tick\Report\BodyResourceState;
use App\GameCoreBundle\Economy\Tick\Report\FlowScope;
use App\GameCoreBundle\Economy\Tick\Report\GlobalResourcePressure;
use App\GameCoreBundle\Economy\Tick\Report\ResourceFlow;
use App\GameCoreBundle\Economy\Tick\Report\SystemResourceSummary;
use App\GameCoreBundle\Economy\Tick\Report\TickReport;

/**
 * Runs the full GameFlow calculation as a single streaming fold over a
 * system-ordered row stream, producing only the small, bounded aggregates
 * (system summaries, global pressures, component costs, per-material pressure
 * distribution) into the {@see TickReport}.
 *
 * The two large, per-resource outputs are pushed to caller-supplied sinks instead
 * of being retained: each body state is emitted as it is computed, and each
 * system's inter-object flows are emitted the moment that system's rows end. As a
 * result the calculation's peak memory is O(systems x materials), independent of
 * the number of celestial bodies. It performs no mutations: feeding a freshly
 * seeded world to this aggregator reproduces the spreadsheet's numbers exactly.
 */
final class TickCalculator
{
    public function __construct(
        private readonly ResourceTickComputer $computer,
        private readonly Materials $materials,
        private readonly SystemSummaryCalculator $systemSummary,
        private readonly DistributionCalculator $distribution,
        private readonly PressureCalculator $pressure,
        private readonly ComponentCostCalculator $componentCost,
    ) {
    }

    /**
     * @param iterable<ResourceTickRow> $rows rows ordered by system, then body, then resource
     * @param callable(BodyResourceState): void $bodyStateSink
     * @param callable(ResourceFlow): void $flowSink
     */
    public function aggregate(TickReport $report, iterable $rows, callable $bodyStateSink, callable $flowSink): void
    {
        $supplyBySystem = [];
        $demandBySystem = [];
        $systemOrder = [];
        $totalFreeByMaterial = [];
        $totalStockByMaterial = [];

        $currentSystem = null;
        $imbalanceBuffer = [];

        foreach ($rows as $row)
        {
            $computed = $this->computer->compute($row);

            if ($currentSystem !== $row->systemIdentifier)
            {
                if ($currentSystem !== null)
                {
                    $this->flushInterObjectFlows($imbalanceBuffer, $flowSink);
                    $imbalanceBuffer = [];
                }

                $currentSystem = $row->systemIdentifier;
                $systemOrder[] = $currentSystem;
            }

            $bodyStateSink(new BodyResourceState(
                $row->systemIdentifier,
                $row->bodyIdentifier,
                $row->materialIdentifier,
                $computed->physicalSupply,
                $computed->depletionRate,
                $computed->ticksLeft,
                $computed->decayedStock,
                $computed->supply,
                $computed->demand,
                $computed->surplus,
                $computed->deficit,
                $computed->imbalance,
                $computed->ticksToFullOrEmpty,
            ));

            $material = $row->materialIdentifier;
            $supplyBySystem[$currentSystem][$material] = ($supplyBySystem[$currentSystem][$material] ?? 0.0) + $computed->supply;
            $demandBySystem[$currentSystem][$material] = ($demandBySystem[$currentSystem][$material] ?? 0.0) + $computed->demand;
            $imbalanceBuffer[$material][$row->bodyIdentifier] = $computed->imbalance;
            $totalFreeByMaterial[$material] = ($totalFreeByMaterial[$material] ?? 0.0) + $computed->free;
            $totalStockByMaterial[$material] = ($totalStockByMaterial[$material] ?? 0.0) + $computed->baseStock;
        }

        if ($currentSystem !== null)
        {
            $this->flushInterObjectFlows($imbalanceBuffer, $flowSink);
        }

        $this->buildSystemSummaries($systemOrder, $supplyBySystem, $demandBySystem, $report);
        $this->buildComponentCosts($systemOrder, $report);
        $this->buildInterSystemFlows($report, $flowSink);
        $this->buildPressure($report, $totalFreeByMaterial, $totalStockByMaterial);
    }

    /**
     * @param string[] $systemOrder
     * @param array<string, array<string, float>> $supplyBySystem
     * @param array<string, array<string, float>> $demandBySystem
     */
    private function buildSystemSummaries(array $systemOrder, array $supplyBySystem, array $demandBySystem, TickReport $report): void
    {
        foreach ($systemOrder as $systemIdentifier)
        {
            foreach ($supplyBySystem[$systemIdentifier] ?? [] as $materialIdentifier => $supply)
            {
                $demand = $demandBySystem[$systemIdentifier][$materialIdentifier];
                $imbalance = $supply - $demand;
                $material = $this->materials->get($materialIdentifier);
                $basePrice = $material instanceof PricedMaterialInterface ? $material->getBasePrice() : 1.0;
                $priceSensitivity = $material instanceof PricedMaterialInterface ? $material->getPriceScarcitySensitivity() : 0.0;

                $localScarcityIndex = $this->systemSummary->localScarcityIndex($imbalance, $demand);
                $localPrice = $this->systemSummary->localPrice(
                    $basePrice,
                    $priceSensitivity,
                    $localScarcityIndex,
                );

                $report->addSystemSummary(new SystemResourceSummary(
                    $systemIdentifier,
                    $materialIdentifier,
                    $supply,
                    $demand,
                    $imbalance,
                    $localScarcityIndex,
                    $localPrice,
                ));
            }
        }
    }

    /**
     * @param string[] $systemOrder
     */
    private function buildComponentCosts(array $systemOrder, TickReport $report): void
    {
        // Single pass: index every system's local prices by material.
        $localPricesBySystem = [];

        foreach ($report->systemSummaries as $summary)
        {
            $localPricesBySystem[$summary->systemIdentifier][$summary->materialIdentifier] = $summary->localPrice;
        }

        foreach ($systemOrder as $systemIdentifier)
        {
            $localPrices = $localPricesBySystem[$systemIdentifier] ?? [];

            foreach ($this->materials->all as $material)
            {
                $processes = $this->materials->processesByOutput[$material->getIdentifier()] ?? [];

                if ($processes === [])
                {
                    continue;
                }

                // A material may be produced by more than one process; the first
                // recipe is used as its representative production cost.
                $cost = $this->componentCost->cost($processes[0], $localPrices);
                $report->addComponentCost($systemIdentifier, $material->getIdentifier(), $cost);
            }
        }
    }

    /**
     * @param callable(ResourceFlow): void $flowSink
     */
    private function buildInterSystemFlows(TickReport $report, callable $flowSink): void
    {
        $imbalancesByMaterial = [];

        foreach ($report->systemSummaries as $summary)
        {
            $imbalancesByMaterial[$summary->materialIdentifier][$summary->systemIdentifier] = $summary->imbalance;
        }

        foreach ($imbalancesByMaterial as $materialIdentifier => $imbalances)
        {
            foreach ($this->matchFlows($imbalances) as [$from, $to, $amount])
            {
                $flowSink(new ResourceFlow(FlowScope::InterSystem, $materialIdentifier, $from, $to, $amount));
            }
        }
    }

    /**
     * @param array<string, float> $totalFreeByMaterial
     * @param array<string, float> $totalStockByMaterial
     */
    private function buildPressure(TickReport $report, array $totalFreeByMaterial, array $totalStockByMaterial): void
    {
        $supplyByMaterial = [];
        $demandByMaterial = [];

        foreach ($report->systemSummaries as $summary)
        {
            $supplyByMaterial[$summary->materialIdentifier] = ($supplyByMaterial[$summary->materialIdentifier] ?? 0.0) + $summary->supply;
            $demandByMaterial[$summary->materialIdentifier] = ($demandByMaterial[$summary->materialIdentifier] ?? 0.0) + $summary->demand;
        }

        foreach ($supplyByMaterial as $materialIdentifier => $totalSupply)
        {
            $totalDemand = $demandByMaterial[$materialIdentifier];
            $totalImbalance = $totalSupply - $totalDemand;
            $material = $this->materials->get($materialIdentifier);
            $desiredScarcityIndex = $material instanceof PricedMaterialInterface ? $material->getDesiredScarcityIndex() : 0.0;

            $scarcityIndex = $this->pressure->scarcityIndex($totalImbalance, $totalDemand);
            $pressureValue = $this->pressure->pressure($scarcityIndex, $desiredScarcityIndex);
            $nudge = $this->pressure->nudge($pressureValue, $totalDemand);
            $introduce = $this->pressure->introduce($nudge);
            $expire = $this->pressure->expire($nudge);

            $report->addPressure(new GlobalResourcePressure(
                $materialIdentifier,
                $totalSupply,
                $totalDemand,
                $totalImbalance,
                $scarcityIndex,
                $desiredScarcityIndex,
                $pressureValue,
                $nudge,
                $introduce,
                $expire,
            ));

            $report->addPressureDistribution($materialIdentifier, new MaterialPressure(
                $introduce,
                $expire,
                $totalFreeByMaterial[$materialIdentifier] ?? 0.0,
                $totalStockByMaterial[$materialIdentifier] ?? 0.0,
            ));
        }
    }

    /**
     * @param array<string, array<string, float>> $imbalanceBuffer material => (body => imbalance)
     * @param callable(ResourceFlow): void $flowSink
     */
    private function flushInterObjectFlows(array $imbalanceBuffer, callable $flowSink): void
    {
        foreach ($imbalanceBuffer as $materialIdentifier => $imbalances)
        {
            foreach ($this->matchFlows($imbalances) as [$from, $to, $amount])
            {
                $flowSink(new ResourceFlow(FlowScope::InterObject, $materialIdentifier, $from, $to, $amount));
            }
        }
    }

    /**
     * Greedy surplus -> deficit matching. For the two-participant case this is
     * exactly the spreadsheet's MAX(0, MIN(-ImbalanceTo, ImbalanceFrom)); for
     * more participants it distributes each surplus across the deficits without
     * ever shipping more than a source's surplus or a sink's deficit.
     *
     * @param array<string, float> $imbalances identifier => imbalance
     * @return list<array{0: string, 1: string, 2: float}> from, to, amount
     */
    private function matchFlows(array $imbalances): array
    {
        $surplus = array_filter($imbalances, static fn (float $imbalance): bool => $imbalance > 0.0);
        $deficit = array_map(static fn (float $imbalance): float => -$imbalance, array_filter($imbalances, static fn (float $imbalance): bool => $imbalance < 0.0));

        arsort($surplus);
        arsort($deficit);

        $flows = [];

        foreach ($surplus as $from => $available)
        {
            foreach ($deficit as $to => $needed)
            {
                if ($available <= 0.0)
                {
                    break;
                }

                if ($needed <= 0.0)
                {
                    continue;
                }

                $amount = $this->distribution->flow($available, -$needed);

                if ($amount <= 0.0)
                {
                    continue;
                }

                $flows[] = [(string) $from, (string) $to, $amount];
                $available -= $amount;
                $deficit[$to] -= $amount;
            }
        }

        return $flows;
    }
}
