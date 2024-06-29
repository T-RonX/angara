<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain\Color;

class ColorGradiant
{
    /**
     * @param int $colorCount Total number of colors in the gradiant.
     * @param GradiantStop[] $stops Transition points in the gradiant.
    */
    public function  __construct(
        private int $colorCount,
        private array $stops,
    ) {
    }

    public function getColorCount(): int
    {
        return $this->colorCount;
    }

    public function setColorCount(int $colorCount): self
    {
        $this->colorCount = $colorCount;

        return $this;
    }

    public function getStops(): array
    {
        return $this->stops;
    }

    public function setStops(array $stops): self
    {
        $this->stops = $stops;

        return $this;
    }
}
