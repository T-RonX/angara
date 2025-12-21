<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain\Color;

use InvalidArgumentException;

class GradiantStop
{
    /**
     * @param ColorRgb $color Color to transition to.
     * @param float $position Position on the gradiant scale, 0.001 to 1.
     */
    public function __construct(
        private ColorRgb $color,
        private float $position,
    ) {
        if ($position < 0 || $position > 1)
        {
            throw new InvalidArgumentException('Gradiant stop must be between 0 and 1.');
        }
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

    public function getPosition(): float
    {
        return $this->position;
    }

    public function setPosition(float $position): self
    {
        $this->position = $position;

        return $this;
    }
}
