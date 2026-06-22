<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Input;

/**
 * The flat, read-optimized input for one resource of a tick: exactly the columns
 * the GameFlow calculation needs, read in a single set-based query instead of
 * hydrating the {@see \App\GameCoreBundle\World\Entity\World} object graph. Static
 * material properties (decay, pricing, raw type) are resolved separately from the
 * cached material catalog by {@see materialIdentifier}.
 */
final readonly class ResourceTickRow
{
    public function __construct(
        public int $resourceId,
        public string $systemIdentifier,
        public string $bodyIdentifier,
        public string $materialIdentifier,
        public float $reserves,
        public float $regenRate,
        public float $extractRate,
        public float $storageCapacity,
        public float $stock,
        public float $demand,
    ) {
    }
}
