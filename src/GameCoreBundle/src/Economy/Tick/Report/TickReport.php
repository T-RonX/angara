<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

/**
 * The full result of a single economy tick: every quantity the GameFlow model
 * produces, layer by layer. Intended for inspection / rendering, it carries no
 * behaviour of its own.
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
}

