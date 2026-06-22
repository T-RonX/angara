<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

/**
 * Aggregated supply/demand for one resource within one system, with its derived
 * local scarcity index and local price.
 */
final readonly class SystemResourceSummary
{
    public function __construct(
        public string $systemIdentifier,
        public string $materialIdentifier,
        public float $supply,
        public float $demand,
        public float $imbalance,
        public float $localScarcityIndex,
        public float $localPrice,
    ) {
    }
}

