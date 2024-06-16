<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

use MapGenerator\PerlinNoiseGenerator;
use SplFixedArray;
use InvalidArgumentException;
use Symfony\Component\DependencyInjection\Attribute\AutowireInline;

class MapGenerator
{
    public function __construct(
        #[AutowireInline(class: PerlinNoiseGenerator::class)] private PerlinNoiseGenerator $perlinNoiseGenerator,
    ) {
    }

    public function generate(?string $seed): array
    {
        $memLim = ini_get('memory_limit');
        ini_set('memory_limit', '-1');

        $size = 1000;

        $this->perlinNoiseGenerator->setPersistence(.60);
        $this->perlinNoiseGenerator->setSize($size);

        if ($seed)
        {
            $this->perlinNoiseGenerator->setMapSeed($seed);
        }

        $map = $this->perlinNoiseGenerator->generate();
        $mapColor = $this->createImage($size, $map);

//        ini_set('memory_limit', $memLim);

        return $mapColor;
    }

    private function getColorGradient(array $controlPoints, int $colorCount): array
    {
        // Validate input
        if ($colorCount < 3) {
            throw new InvalidArgumentException('Color count must be greater than or equal to 3');
        }

        // Validate control points
        $numControlPoints = count($controlPoints);

        if ($numControlPoints < 2)
        {
            throw new InvalidArgumentException('Control points array must contain at least two elements');
        }

        foreach ($controlPoints as $point)
        {
            if (!isset($point['color']) || !is_array($point['color']) || count($point['color']) !== 3)
            {
                throw new InvalidArgumentException('Control points must be arrays with a "color" key containing an RGB array');
            }

            if ($point['position'] < 0 || $point['position'] > 1) {
                throw new InvalidArgumentException('Control point positions must be between 0 and 1');
            }
        }

        // Ensure control points are sorted by position
        usort($controlPoints, function ($a, $b) {
            return $a['position'] <=> $b['position'];
        });

        // Total segments based on control points and color count
        $totalSegments = $colorCount - 1 + $numControlPoints;

        // Step size between segments
        $stepSize = (1.0 / $totalSegments);

        $gradient = [];

        // Initialize currentControlPoint to the first element (if it exists)
        $currentControlPoint = isset($controlPoints[0]) ? $controlPoints[0] : null;

        $currentSegment = 0;

        // Loop through each segment
        for ($i = 0; $i < $colorCount; $i++)
        {
            $t = $i * $stepSize;

            // Check if we've reached a new control point segment
            if ($currentSegment < $numControlPoints - 1 && $t >= $controlPoints[$currentSegment + 1]['position']) {
                $currentSegment++;
                $currentControlPoint = $controlPoints[$currentSegment];
            }



            // Determine colors for lerp based on segment (handle last segment)
            if (isset($controlPoints[$currentSegment + 1]))
            {
                $nextControlPoint = $controlPoints[$currentSegment + 1];
                $gradient[] = $this->lerpColor($currentControlPoint['color'], $nextControlPoint['color'], ($t - $currentControlPoint['position']) / ($nextControlPoint['position'] - $currentControlPoint['position']));
            }
            else
            {
                // Use last control point color for the remaining segments
                $gradient[] = $currentControlPoint['color'];
            }
        }

        return $gradient;
    }

    private function lerpColor(array $color1, array $color2, float $t): array
    {
        return [
            round($color1[0] * (1 - $t) + $color2[0] * $t),
            round($color1[1] * (1 - $t) + $color2[1] * $t),
            round($color1[2] * (1 - $t) + $color2[2] * $t),
        ];
    }

    private function createImage(int $size, SplFixedArray $map)
    {
        $mapColors = [];

        $colors = $this->getColorGradient([
                ['color' => [0, 0, 59], 'position' => 0],
                ['color' => [0, 0, 176], 'position' => .01],
                ['color' => [15, 133, 50], 'position' => .02],
                ['color' => [29, 161, 7], 'position' => .05],
                ['color' => [29, 181, 7], 'position' => .9],
                ['color' => [157, 199, 4], 'position' => .92],
                ['color' => [185, 15, 22], 'position' => .95],
                ['color' => [20, 20, 20], 'position' => 1],
            ],
            128
        );

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
                $color_index = floor($this->sigmoid($norm_value) * (count($colors) - 1));

                $r = $colors[$color_index][0];
                $g = $colors[$color_index][1];
                $b = $colors[$color_index][2];

                $mapColors[$iy][$ix] = [$r, $g, $b];

                $color = imagecolorallocate($image, (int)$r, (int)$g, (int)$b);
                imagesetpixel($image, $ix, $iy, $color);
            }
        }

        @unlink('/var/www/html/src/dla.png');
        imagepng($image, '/var/www/html/src/dla.png');
        imagedestroy($image);

        return $mapColors;
    }

    private function sigmoid($value): float
    {
        // -12 to -20
        return 1 / (1 + exp(-14 * ($value - 0.5)));
    }
}
