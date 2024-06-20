<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

use App\Game\Map\Generator\MapDescriptor\MapDescriptor;

class MapDecorator
{
    public function decorate(string $sourcePath, MapDescriptor $mapDescriptor): void
    {
        $image = imagecreatefromstring(file_get_contents($sourcePath));

        for ($x = 0;  $x < 20; $x++)
        {
            for ($y = 0;  $y < 20; $y++)
            {
                $color = imagecolorat($image, $x, $y);
                $r = ($color >> 16) & 0xFF;
                $g = ($color >> 8) & 0xFF;
                $b = $color & 0xFF;

                $newColor = $this->getRandomColor($r, $g, $b, 4, $image);
                imagesetpixel($image, $x, $y, $newColor);
            }
        }

        imagepng($image, $sourcePath);
        imagedestroy($image);
    }

    function getRandomColor($r, $g, $b, $variation = 10, $image) {
        $r = min(max(0, $r + random_int(-$variation, $variation)), 255);
        $g = min(max(0, $g + random_int(-$variation, $variation)), 255);
        $b = min(max(0, $b + random_int(-$variation, $variation)), 255);

        return imagecolorallocate($image, $r, $g, $b);
    }
}
