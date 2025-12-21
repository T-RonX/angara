<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Decorator;

use App\Game\Game\Environment\Generator\Planet\Terrain\MapDescriptor;
use GdImage;

class TerrainDecorator
{
    public function decorate(GdImage $image, MapDescriptor $mapDescriptor): void
    {
        for ($x = 0;  $x < 45; $x++)
        {
            for ($y = 0;  $y < 45; $y++)
            {
                $color = imagecolorat($image, $x, $y);
                $r = ($color >> 16) & 0xFF;
                $g = ($color >> 8) & 0xFF;
                $b = $color & 0xFF;

                $newColor = $this->getRandomColor($r, $g, $b, 10, $image);
                imagesetpixel($image, $x, $y, $newColor);
            }
        }
    }

    function getRandomColor($r, $g, $b, $variation, $image)
    {
        $var = random_int(-$variation, $variation);
        $r = min(max(0, $r + $var), 255);
        $g = min(max(0, $g + $var), 255);
        $b = min(max(0, $b + $var), 255);

        return imagecolorallocate($image, $r, $g, $b);
    }
}
