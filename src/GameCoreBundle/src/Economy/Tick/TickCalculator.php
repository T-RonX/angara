<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Calculation\ComponentCostCalculator;
use App\GameCoreBundle\Economy\Calculation\DistributionCalculator;
use App\GameCoreBundle\Economy\Calculation\PhysicalLayerCalculator;
use App\GameCoreBundle\Economy\Calculation\PressureCalculator;
use App\GameCoreBundle\Economy\Calculation\ProductionLayerCalculator;
use App\GameCoreBundle\Economy\Calculation\SystemSummaryCalculator;
use App\GameCoreBundle\Economy\Contract\ResourceInterface;
use App\GameCoreBundle\Economy\Material\Materials;
use App\GameCoreBundle\Economy\Material\PricedMaterialInterface;
use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;
use App\GameCoreBundle\Economy\Tick\Report\BodyResourceState;
use App\GameCoreBundle\Economy\Tick\Report\FlowScope;
use App\GameCoreBundle\Economy\Tick\Report\GlobalResourcePressure;
use App\GameCoreBundle\Economy\Tick\Report\ResourceFlow;
use App\GameCoreBundle\Economy\Tick\Report\SystemResourceSummary;
use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use App\GameCoreBundle\World\Entity\World;

/**
 * Runs the full GameFlow calculation over a world snapshot and produces a
 * {@see TickReport}. It performs no mutations: feeding a freshly seeded world to
 * this calculator reproduces the spreadsheet's numbers exactly.
 */
final class TickCalculator
{
    public function __construct(
        private readonly Materials $materials,
        private readonly PhysicalLayerCalculator $physical,
        private readonly ProductionLayerCalculator $production,
        private readonly SystemSummaryCalculator $systemSummary,
        private readonly DistributionCalculator $distribution,
        private readonly PressureCalculator $pressure,
        private readonly ComponentCostCalculator $componentCost,
    ) {
    }

    public function calculate(World $world, int $tick): TickReport
    {
        $report = new TickReport($tick, $world->getIdentifier());

        $this->calculatePhysicalAndProduction($world, $report);
        $this->calculateSystemSummaries($world, $report);
        $this->calculateComponentCosts($world, $report);
        $this->calculateInterObjectFlows($world, $report);
        $this->calculateInterSystemFlows($report);
        $this->calculatePressure($report);

        return $report;
    }

    private function calculatePhysicalAndProduction(World $world, TickReport $report): void
    {
        foreach ($world->getSystems() as $system)
        {
            foreach ($system->getCelestialBodies() as $body)
            {
                foreach ($body->getResources() as $resource)
                {
                    $material = $resource->getMaterial();
                    $rawType = $material instanceof ResourceInterface ? $material->getRawType() : RawMaterialType::Deposit;
                    $decayRate = $material->getStorageDecayRate();

                    // Layer 0 (physical)
                    $physicalSupply = $this->physical->supply($resource->getExtractRate(), $resource->getRegenRate(), $resource->getReserves());
                    $depletionRate = $this->physical->depletionRate($resource->getExtractRate(), $resource->getRegenRate());
                    $ticksLeft = $this->physical->ticksLeft($rawType, $resource->getReserves(), $resource->getRegenRate(), $depletionRate);

                    // Layer 1 (production)
                    $decayedStock = $this->production->decayedStock($resource->getStock(), $decayRate);
                    $supply = $this->production->supply($physicalSupply, $resource->getStorageCapacity(), $decayedStock);
                    $demand = $resource->getDemand();
                    $surplus = $this->production->surplus($supply, $demand);
                    $deficit = $this->production->deficit($supply, $demand);
                    $imbalance = $this->production->imbalance($supply, $demand);
                    $ticksToFullOrEmpty = $this->production->ticksToFullOrEmpty($resource->getStorageCapacity(), $decayedStock, $supply, $demand);

                    $report->addBodyState(new BodyResourceState(
                        $system->getIdentifier(),
                        $body->getIdentifier(),
                        $resource->getMaterialIdentifier(),
                        $physicalSupply,
                        $depletionRate,
                        $ticksLeft,
                        $decayedStock,
                        $supply,
                        $demand,
                        $surplus,
                        $deficit,
                        $imbalance,
                        $ticksToFullOrEmpty,
                    ));
                }
            }
        }
    }

    private function calculateSystemSummaries(World $world, TickReport $report): void
    {
        foreach ($world->getSystems() as $system)
        {
            $supplyByMaterial = [];
            $demandByMaterial = [];

            foreach ($report->bodyStates as $state)
            {
                if ($state->systemIdentifier !== $system->getIdentifier())
                {
                    continue;
                }

                $supplyByMaterial[$state->materialIdentifier] = ($supplyByMaterial[$state->materialIdentifier] ?? 0.0) + $state->supply;
                $demandByMaterial[$state->materialIdentifier] = ($demandByMaterial[$state->materialIdentifier] ?? 0.0) + $state->demand;
            }

            foreach ($supplyByMaterial as $materialIdentifier => $supply)
            {
                $demand = $demandByMaterial[$materialIdentifier];
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
                    $system->getIdentifier(),
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

    private function calculateComponentCosts(World $world, TickReport $report): void
    {
        foreach ($world->getSystems() as $system)
        {
            $localPrices = [];
            foreach ($report->systemSummaries as $summary)
            {
                if ($summary->systemIdentifier === $system->getIdentifier())
                {
                    $localPrices[$summary->materialIdentifier] = $summary->localPrice;
                }
            }

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
                $report->addComponentCost($system->getIdentifier(), $material->getIdentifier(), $cost);
            }
        }
    }

    private function calculateInterObjectFlows(World $world, TickReport $report): void
    {
        foreach ($world->getSystems() as $system)
        {
            $imbalancesByMaterial = [];

            foreach ($report->bodyStates as $state)
            {
                if ($state->systemIdentifier !== $system->getIdentifier())
                {
                    continue;
                }

                $imbalancesByMaterial[$state->materialIdentifier][$state->bodyIdentifier] = $state->imbalance;
            }

            foreach ($imbalancesByMaterial as $materialIdentifier => $imbalances)
            {
                foreach ($this->matchFlows($imbalances) as [$from, $to, $amount])
                {
                    $report->addFlow(new ResourceFlow(FlowScope::InterObject, $materialIdentifier, $from, $to, $amount));
                }
            }
        }
    }

    private function calculateInterSystemFlows(TickReport $report): void
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
                $report->addFlow(new ResourceFlow(FlowScope::InterSystem, $materialIdentifier, $from, $to, $amount));
            }
        }
    }

    private function calculatePressure(TickReport $report): void
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
            $pressure = $this->pressure->pressure($scarcityIndex, $desiredScarcityIndex);
            $nudge = $this->pressure->nudge($pressure, $totalDemand);

            $report->addPressure(new GlobalResourcePressure(
                $materialIdentifier,
                $totalSupply,
                $totalDemand,
                $totalImbalance,
                $scarcityIndex,
                $desiredScarcityIndex,
                $pressure,
                $nudge,
                $this->pressure->introduce($nudge),
                $this->pressure->expire($nudge),
            ));
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

