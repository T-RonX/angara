<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain\Color;

use InvalidArgumentException;

class ColorRgb
{
    /**
     * @param int $red Red tint, 0 to 255.
     * @param int $green Green tint, 0 to 255.
     * @param int $blue Blue tint, 0 to 255.
     */
    public function __construct(
        private int $red,
        private int $green,
        private int $blue,
    ) {
    }

    public static function fromHex(string $color): self
    {
        $color = ltrim($color, '#');

        if (strlen($color) !== 3 && strlen($color) !== 6)
        {
            throw new InvalidArgumentException('Invalid hex color string provided.');
        }

        $red = hexdec(substr($color, 0, 2));
        $green = hexdec(substr($color, 2, 2));
        $blue = hexdec(substr($color, 4, 2));

        if ($red < 0 || $red > 255 || $green < 0 || $green > 255 || $blue < 0 || $blue > 255)
        {
            throw new InvalidArgumentException('Invalid color value in hex string.');
        }

        return new static($red, $green, $blue);
    }

    public function toArray(): array
    {
        return [
            $this->red,
            $this->green,
            $this->blue,
        ];
    }

    public function getRed(): int
    {
        return $this->red;
    }

    public function setRed(int $red): self
    {
        $this->red = $red;

        return $this;
    }

    public function getGreen(): int
    {
        return $this->green;
    }

    public function setGreen(int $green): self
    {
        $this->green = $green;

        return $this;
    }

    public function getBlue(): int
    {
        return $this->blue;
    }

    public function setBlue(int $blue): self
    {
        $this->blue = $blue;

        return $this;
    }
}
