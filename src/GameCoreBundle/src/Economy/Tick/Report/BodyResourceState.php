<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

/**
 * Computed Layer 0 + Layer 1 values for one resource on one celestial body.
 */
final readonly class BodyResourceState
{
    public function __construct(
        public string $systemIdentifier,
        public string $bodyIdentifier,
        public string $materialIdentifier,
        // Layer 0 (physical)
        public float $physicalSupply,
        public float $depletionRate,
        public float $ticksLeft,
        // Layer 1 (production)
        public float $decayedStock,
        public float $supply,
        public float $demand,
        public float $surplus,
        public float $deficit,
        public float $imbalance,
        public float $ticksToFullOrEmpty,
    ) {
    }
}

