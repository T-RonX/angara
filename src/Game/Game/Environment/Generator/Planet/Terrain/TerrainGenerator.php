<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use App\Game\Environment\Generator\Planet\Terrain\InvalidArgumentException;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorGradiant;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\GradiantStop;
use SplFixedArray;

class TerrainGenerator
{
    private MapDescriptor $mapDescriptor;

    /**
     * @return array<int, array<int, array<int>>>
     */
    public function generate(MapDescriptor $mapDescriptor, $size, $map, $targetFile): array
    {
        $this->mapDescriptor = $mapDescriptor;

        $this->createImage($size, $map, $targetFile);

        return $this->createTerrain($size, $map, $targetFile);
    }

    /**
     * @return array<int, array<int, array<int>>>
     */
    private function createTerrain(int $size, SplFixedArray $map, $destinationPath): array
    {
        $mapColors = [];
        $terrainColors = [];

        foreach ($this->mapDescriptor->getTerrain()->getTypes() as $i => $terrainType)
        {
            $terrainColors[$i] = $this->getColorGradient($terrainType->getColorGradiant());
        }

        $max = 0;
        $min = PHP_INT_MAX;

        for ($iy = 0; $iy < $size; $iy++)
        {
            for ($ix = 0; $ix < $size; $ix++)
            {
                $h = $map[$iy][$ix];
                if ($min > $h)
                {
                    $min = $h;
                }
                if ($max < $h)
                {
                    $max = $h;
                }
            }
        }

        $diff = $max - $min;

        $terrainCache = [];

        for ($iy = 0; $iy < $size; $iy++)
        {
            for ($ix = 0; $ix < $size; $ix++)
            {
                $norm_value = ($map[$iy][$ix] - $min) / $diff;
//                $color_index = (int) round($this->sigmoid($norm_value) * (count($colors) - 1));
//                $color_index = $this->normalize($norm_value, $min, $max);

                $epsilon = 1e-10;
                $terrain = $this->mapDescriptor->getTerrain()->getTerrain($norm_value);
                $colors = $terrainColors[$terrain->getId()];
                $color_index = (int) round($this->normalize($norm_value, $terrain->getStart(), $terrain->getEnd()) * (count($colors) - (.5 + $epsilon)));

                $r = $colors[$color_index][0];
                $g = $colors[$color_index][1];
                $b = $colors[$color_index][2];

                $mapColors[$iy][$ix] = new GeneratedTerrain($terrain->getProperties(), new ColorRgb($r, $g, $b));
            }
        }

        return $mapColors;
    }

    private function createImage(int $size, SplFixedArray $map, $destinationPath): array
    {
        $mapColors = [];
        $terrainColors = [];

        foreach ($this->mapDescriptor->getTerrain()->getTypes() as $i => $terrainType)
        {
            $terrainColors[$i] = $this->getColorGradient($terrainType->getColorGradiant());
        }

        $image = imagecreatetruecolor($size, $size);

        $max = 0;
        $min = PHP_INT_MAX;
        for ($iy = 0; $iy < $size; $iy++)
        {
            for ($ix = 0; $ix < $size; $ix++)
            {
                $h = $map[$iy][$ix];
                if ($min > $h)
                {
                    $min = $h;
                }
                if ($max < $h)
                {
                    $max = $h;
                }
            }
        }
        $diff = $max - $min;

        for ($iy = 0; $iy < $size; $iy++)
        {
            for ($ix = 0; $ix < $size; $ix++)
            {
                $norm_value = ($map[$iy][$ix] - $min) / $diff;
//                $color_index = (int) round($this->sigmoid($norm_value) * (count($colors) - 1));
//                $color_index = $this->normalize($norm_value, $min, $max);

                $epsilon = 1e-10;
                $terrain = $this->mapDescriptor->getTerrain()->getTerrain($norm_value);
                $colors = $terrainColors[$terrain->getId()];
                $color_index = (int) round($this->normalize($norm_value, $terrain->getStart(), $terrain->getEnd()) * (count($colors) - (.5 + $epsilon)));

                $r = $colors[$color_index][0];
                $g = $colors[$color_index][1];
                $b = $colors[$color_index][2];

                $mapColors[$iy][$ix] = [$r, $g, $b];

                $color = imagecolorallocate($image, (int)$r, (int)$g, (int)$b);
                imagesetpixel($image, $ix, $iy, $color);
            }
        }

        @unlink($destinationPath);
        imagewebp($image, $destinationPath, IMG_WEBP_LOSSLESS);
        imagedestroy($image);

        return $mapColors;
    }

    /**
     * @return array
     */
    private function getColorGradient(ColorGradiant $colorGradiant): array
    {
        $numControlPoints = count($colorGradiant->getStops());

        // Validate control points
        if ($numControlPoints < 1)
        {
            throw new InvalidArgumentException('Control points array must contain at least two elements');
        }

        // Validate input
        if ($colorGradiant->getColorCount() === 1)
        {
            return [
                $colorGradiant->getStops()[0]->getColor()->toArray(),
            ];
        }


        // Validate input
        if ($colorGradiant->getColorCount() === 2)
        {
            return [
                $colorGradiant->getStops()[0]->getColor()->toArray(),
                $colorGradiant->getStops()[1]->getColor()->toArray(),
            ];
        }

        $stops = $colorGradiant->getStops();

        // Ensure control points are sorted by position
        usort($stops, static fn (GradiantStop $a, GradiantStop $b) => $a->getPosition() <=> $b->getPosition());

        $gradient = [];
        $controlPointIndex = 0;

        for ($i = 0, $colorCount = $colorGradiant->getColorCount(); $i < $colorCount; ++$i)
        {
            // Calculate the relative position of the current gradient point
            $t = $i / ($colorCount - 1);

            // Move to the next control point if needed
            while ($controlPointIndex < $numControlPoints - 1 && $t > $stops[$controlPointIndex + 1]->getPosition())
            {
                $controlPointIndex++;
            }

            // Determine the start and end control points for interpolation
            $startPoint = $stops[$controlPointIndex];
            $endPoint = ($controlPointIndex < $numControlPoints - 1) ? $stops[$controlPointIndex + 1] : $startPoint;

            // Calculate the local position between the start and end control points
            $localT = ($t - $startPoint->getPosition()) / ($endPoint->getPosition() - $startPoint->getPosition());

            // Lerp between the start and end colors
            $gradient[] = $this->lerpColor($startPoint->getColor(), $endPoint->getColor(), $localT);
        }

        return $gradient;
    }

    private function lerpColor(ColorRgb $startColor, ColorRgb $endColor, float $t): array
    {
        return [
            (int)round($startColor->getRed() + ($endColor->getRed() - $startColor->getRed()) * $t),
            (int)round($startColor->getGreen() + ($endColor->getGreen() - $startColor->getGreen()) * $t),
            (int)round($startColor->getBlue() + ($endColor->getBlue() - $startColor->getBlue()) * $t)
        ];
    }

    private function sigmoid($value): float
    {
        // -12 to -20
        return 1 / (1 + exp($this->mapDescriptor->getElevationLevel() * ($value - 0.5)));
    }

    function normalize($value, $min, $max): float
    {
        return ($value - $min) / ($max - $min);
    }
}
