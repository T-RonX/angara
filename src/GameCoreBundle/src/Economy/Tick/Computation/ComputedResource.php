<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Computation;

/**
 * The deterministic per-resource result of Layer 0 (physical) + Layer 1
 * (production), plus the base next-tick reserves/stock the evolution starts from.
 *
 * Because every value here is a pure function of a {@see
 * \App\GameCoreBundle\Economy\Tick\Input\ResourceTickRow} and the material catalog,
 * both streaming passes of a tick recompute it instead of retaining a per-body
 * object graph in memory: the aggregation pass turns it into report rows, the
 * evolution pass turns it into a persistent state change.
 */
final readonly class ComputedResource
{
    public function __construct(
        public float $physicalSupply,
        public float $depletionRate,
        public float $ticksLeft,
        public float $decayedStock,
        public float $supply,
        public float $demand,
        public float $surplus,
        public float $deficit,
        public float $imbalance,
        public float $ticksToFullOrEmpty,
        // Base next-tick persistent state, before Layer 4 pressure is applied.
        public float $baseReserves,
        public float $baseStock,
        public float $free,
    ) {
    }
}
