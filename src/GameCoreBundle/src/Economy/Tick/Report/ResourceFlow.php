<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

/**
 * A single recommended (and applied) distribution of a resource, either between
 * objects of a system (Layer 2) or between systems (Layer 3).
 */
final readonly class ResourceFlow
{
    public function __construct(
        public FlowScope $scope,
        public string $materialIdentifier,
        public string $fromIdentifier,
        public string $toIdentifier,
        public float $amount,
    ) {
    }
}

