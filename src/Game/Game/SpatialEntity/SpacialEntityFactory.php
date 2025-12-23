<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity;

class SpacialEntityFactory
{
    public function createCoordinate(int $x, int $y): Coordinate
    {
        return new Coordinate($x, $y);
    }
}
