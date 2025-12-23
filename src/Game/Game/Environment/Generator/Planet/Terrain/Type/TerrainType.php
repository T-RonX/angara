<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain\Type;

use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorGradiant;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;
use App\Game\Game\Environment\Generator\Planet\Terrain\TerrainProperties;

class TerrainType
{
    private int $id;

    public function __construct(
        public private(set) float|null $threshold,
        private TerrainProperties $properties,
        public ColorRgb $color,
    ) {
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;

        return $this;
    }

    public function getStart(): float
    {
        return $this->start;
    }

    public function setStart(float $start): self
    {
        $this->start = $start;

        return $this;
    }

    public function getEnd(): float
    {
        return $this->end;
    }

    public function setEnd(float $end): self
    {
        $this->end = $end;

        return $this;
    }

    public function getColorGradiant(): ColorGradiant
    {
        return $this->colorGradiant;
    }

    public function setColorGradiant(ColorGradiant $colorGradiant): self
    {
        $this->colorGradiant = $colorGradiant;

        return $this;
    }

    public function getProperties(): TerrainProperties
    {
        return $this->properties;
    }
}
