<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;

class TerrainProperties
{
    private ColorRgb $color;

    public function __construct(
        private string $id,
    ) {
    }

    public function getId(): string
    {
        return $this->id;
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
