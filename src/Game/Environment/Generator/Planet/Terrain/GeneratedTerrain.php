<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain;

use App\Game\Environment\Generator\Planet\Terrain\Color\ColorGradiant;
use App\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;
use App\Game\Environment\Generator\Planet\Terrain\Type\TerrainType;

class GeneratedTerrain
{
    public function __construct(
        private TerrainProperties $properties,
        private ColorRgb $color,
    ) {
    }

    public function getProperties(): TerrainProperties
    {
        return $this->properties;
    }

    public function getColor(): ColorRgb
    {
        return $this->color;
    }

    public function setColor(ColorRgb $color): self
    {
        $this->color = $color;

        return $this;
    }
}
