<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\SpatialGrid;

use App\GameCoreBundle\World\Noise\NoiseGrid;
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
