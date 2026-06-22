<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Evolution;

use App\GameCoreBundle\Economy\Tick\Aggregation\MaterialPressure;
use App\GameCoreBundle\Economy\Tick\Computation\ResourceTickComputer;
use App\GameCoreBundle\Economy\Tick\Input\ResourceTickRow;

/**
 * Derives the next-tick persistent state of every resource and streams it out as
 * {@see ResourceStateChange} to a caller-supplied sink, holding no per-resource
 * state of its own.
 *
 *  1. Physical + production: reserves deplete, stock decays, is produced into and
 *     consumed by demand (Layers 0 and 1). These base values are recomputed from
 *     the row by the shared {@see ResourceTickComputer}.
 *  2. Pressure: the world introduces or expires the resource to stabilize its
 *     global scarcity index (Layer 4). Introduce and expire are mutually exclusive
 *     per material, so each resource's share is a single proportional adjustment
 *     against the world-wide free space (introduce) or stock (expire) accumulated
 *     by the aggregation pass.
 *
 * The distribution flows (Layers 2 and 3) are reported but, for now, deliberately
 * NOT applied to the persistent state — they are informational only.
 */
final class StateEvolver
{
    public function __construct(
        private readonly ResourceTickComputer $computer,
    ) {
    }

    /**
     * @param iterable<ResourceTickRow> $rows
     * @param array<string, MaterialPressure> $pressureByMaterial
     * @param callable(ResourceStateChange): void $changeSink
     */
    public function streamChanges(iterable $rows, array $pressureByMaterial, callable $changeSink): void
    {
        foreach ($rows as $row)
        {
            $computed = $this->computer->compute($row);
            $stock = $computed->baseStock;
            $pressure = $pressureByMaterial[$row->materialIdentifier] ?? null;

            if ($pressure !== null)
            {
                if ($pressure->introduce > 0.0 && $pressure->totalFree > 0.0)
                {
                    // Distribute the introduction proportionally to free storage,
                    // never exceeding this resource's own free space.
                    $stock += min($computed->free, $pressure->introduce * ($computed->free / $pressure->totalFree));
                }
                elseif ($pressure->expire > 0.0 && $pressure->totalStock > 0.0)
                {
                    // Distribute the expiry proportionally to stock, never going
                    // below zero.
                    $stock -= min($computed->baseStock, $pressure->expire * ($computed->baseStock / $pressure->totalStock));
                }
            }

            $changeSink(new ResourceStateChange($row->resourceId, $computed->baseReserves, $stock));
        }
    }
}
