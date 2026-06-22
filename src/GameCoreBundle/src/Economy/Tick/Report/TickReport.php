<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

use App\GameCoreBundle\Economy\Tick\Aggregation\MaterialPressure;

/**
 * The result of a single economy tick. The small, bounded aggregates (system
 * summaries, global pressures, component costs and the per-material pressure
 * distribution) are always populated and drive both the read-model write and the
 * persistent evolution. The large per-body detail (body states, flows) is only
 * collected when explicitly requested for rendering, so a production tick never
 * holds an O(resources) graph in memory.
 */
final class TickReport
{
    /** @var BodyResourceState[] */
    public private(set) array $bodyStates = [];

    /** @var SystemResourceSummary[] */
    public private(set) array $systemSummaries = [];

    /** @var GlobalResourcePressure[] */
    public private(set) array $pressures = [];

    /** @var ResourceFlow[] */
    public private(set) array $flows = [];

    /** @var array<string, float> componentIdentifier => cost, indexed per system */
    public private(set) array $componentCosts = [];

    /** @var array<string, MaterialPressure> materialIdentifier => pressure distribution */
    public private(set) array $pressureDistribution = [];

    public function __construct(
        readonly public int $tick,
        readonly public string $worldIdentifier,
    ) {
    }

    public function addBodyState(BodyResourceState $state): void
    {
        $this->bodyStates[] = $state;
    }

    public function addSystemSummary(SystemResourceSummary $summary): void
    {
        $this->systemSummaries[] = $summary;
    }

    public function addPressure(GlobalResourcePressure $pressure): void
    {
        $this->pressures[] = $pressure;
    }

    public function addFlow(ResourceFlow $flow): void
    {
        $this->flows[] = $flow;
    }

    public function addComponentCost(string $systemIdentifier, string $componentIdentifier, float $cost): void
    {
        $this->componentCosts["$systemIdentifier:$componentIdentifier"] = $cost;
    }

    public function addPressureDistribution(string $materialIdentifier, MaterialPressure $pressure): void
    {
        $this->pressureDistribution[$materialIdentifier] = $pressure;
    }
}

