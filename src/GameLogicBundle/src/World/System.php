<?php

declare(strict_types=1);

namespace App\GameLogicBundle\World;

class System
{
    /** @var CelestialBody[] */
    public private(set) array $celestialBodies;

    public function __construct(
        readonly public private(set) string $identifier,
    ) {
    }

    public function addCelestialBody(CelestialBody $celestialBody): static
    {
        $this->celestialBodies[] = $celestialBody;

        return $this;
    }
}
