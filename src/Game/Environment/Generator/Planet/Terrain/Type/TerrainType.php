<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain\Type;

use App\Game\Environment\Generator\Planet\Terrain\Color\ColorGradiant;
use App\Game\Environment\Generator\Planet\Terrain\TerrainProperties;

class TerrainType
{
    private int $id;

    public function __construct(
        private float $start,
        private float $end,
        private TerrainProperties $properties,
        private ColorGradiant $colorGradiant,
    ) {
        if ($this->end === 1.0)
        {
            $this->end = 1.1;
        }
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
