<?php

declare(strict_types=1);

namespace App\GameLogicBundle\World;

class World
{
    /** @var System[] */
    public private(set) array $systems;

    public function __construct(
        readonly public private(set) string $identifier = 'w_1',
    ) {
        $celestialBody1 = new CelestialBody('cb_1');
        $celestialBody2 = new CelestialBody('cb_2');
        $celestialBody3 = new CelestialBody('cb_3');
        $celestialBody4 = new CelestialBody('cb_4');
        $celestialBody5 = new CelestialBody('cb_5');

        $system1 = new System('s_1')
            ->addCelestialBody($celestialBody1)
            ->addCelestialBody($celestialBody2)
            ->addCelestialBody($celestialBody3);

        $system2 = new System('s_2')
            ->addCelestialBody($celestialBody4)
            ->addCelestialBody($celestialBody5);

        $this->addSystem($system1)
            ->addSystem($system2);
    }

    public function addSystem(System $system): static
    {
        $this->systems[] = $system;

        return $this;
    }
}
