<?php

declare(strict_types=1);

namespace App\Game\Game\World\SpatialGrid;

use App\Game\Game\World\Noise\NoiseGrid;
use SplFixedArray;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class SpatialGrid
{
    public function __construct(
        protected(set) NoiseGrid $grid,
    ) {
    }

    public function getGrid(): SplFixedArray
    {
        return $this->grid->grid;
    }
}
