<?php

declare(strict_types=1);

namespace App\Game\Map\Generator\MapDescriptor;

use App\Game\Map\Generator\MapDescriptor\Gradiant\ColorGradiant;

class MapDescriptor
{
    /**
     * @param int $size Size of one edge of the square map.
     * @param float $roughness How intensely elevation changes on the map, range around 0.3 to 0.8.
     * @param float $elevationLevel Modifier for how aggressively elevation is applied, range around -10 to -20. Lower is more elevation spread.
     * @param ColorGradiant $elevationColorGradiant Colors gradiant to apply to elevation levels.
     */
    public function __construct(
        private int $size,
        private float $roughness,
        private float $elevationLevel,
        private ColorGradiant $elevationColorGradiant,
    ) {
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function setSize(int $size): self
    {
        $this->size = $size;

        return $this;
    }

    public function getRoughness(): float
    {
        return $this->roughness;
    }

    public function setRoughness(float $roughness): self
    {
        $this->roughness = $roughness;

        return $this;
    }

    public function getElevationLevel(): float
    {
        return $this->elevationLevel;
    }

    public function setElevationLevel(float $elevationLevel): self
    {
        $this->elevationLevel = $elevationLevel;

        return $this;
    }

    public function getElevationColorGradiant(): ColorGradiant
    {
        return $this->elevationColorGradiant;
    }

    public function setElevationColorGradiant(ColorGradiant $elevationColorGradiant): self
    {
        $this->elevationColorGradiant = $elevationColorGradiant;

        return $this;
    }
}
