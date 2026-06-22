<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

/**
 * Global, world-wide totals and the Layer 4 pressure result for one resource.
 */
final readonly class GlobalResourcePressure
{
    public function __construct(
        public string $materialIdentifier,
        public float $totalSupply,
        public float $totalDemand,
        public float $totalImbalance,
        public float $scarcityIndex,
        public float $desiredScarcityIndex,
        public float $pressure,
        public float $nudge,
        public float $introduce,
        public float $expire,
    ) {
    }
}

