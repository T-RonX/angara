<?php

declare(strict_types=1);

namespace App\GameLogicBundle\World;

class CelestialBody
{
    public function __construct(
        readonly public private(set) string $identifier,
        readonly public private(set) string $resourceMap,
    ) {
    }
}
