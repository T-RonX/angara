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
        if ($colorCount < 3)
        {
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

            if ($point['position'] < 0 || $point['position'] > 1)
            {
                throw new InvalidArgumentException('Control point positions must be between 0 and 1');
            }
        }

        // Ensure control points are sorted by position
        usort($controlPoints, function ($a, $b) {
            return $a['position'] <=> $b['position'];
        });

        $gradient = [];
        $controlPointIndex = 0;

        for ($i = 0; $i < $colorCount; $i++)
        {
            // Calculate the relative position of the current gradient point
            $t = $i / ($colorCount - 1);

            // Move to the next control point if needed
            while ($controlPointIndex < $numControlPoints - 1 && $t > $controlPoints[$controlPointIndex + 1]['position'])
            {
                $controlPointIndex++;
            }

            // Determine the start and end control points for interpolation
            $startPoint = $controlPoints[$controlPointIndex];
            $endPoint = ($controlPointIndex < $numControlPoints - 1) ? $controlPoints[$controlPointIndex + 1] : $startPoint;

            // Calculate the local position between the start and end control points
            $localT = ($t - $startPoint['position']) / ($endPoint['position'] - $startPoint['position']);

            // Lerp between the start and end colors
            $gradient[] = $this->lerpColor($startPoint['color'], $endPoint['color'], $localT);
        }

        return $gradient;
    }

    private function lerpColor(array $startColor, array $endColor, float $t): array
    {
        return [
            (int)round($startColor[0] + ($endColor[0] - $startColor[0]) * $t),
            (int)round($startColor[1] + ($endColor[1] - $startColor[1]) * $t),
            (int)round($startColor[2] + ($endColor[2] - $startColor[2]) * $t)
        ];
    }


    private function createImage(int $size, SplFixedArray $map)
    {
        $mapColors = [];

        $color_w_deep = '#00003B';
        $color_w_mid = '#0000B0';
        $color_w_shallow = '#0F8532';

        $color_l_flat_1 = '#1DA107';
        $color_l_flat_2 = '#1DB507';

        $color_m_rough = '#9DC704';
        $color_w_mid = '#B90F16';
        $color_w_peaks = '#563227';

        $colors = $this->getColorGradient([
                ['color' => [0, 0, 59], 'position' => 0],
                ['color' => [0, 0, 176], 'position' => .01],
                ['color' => [15, 133, 50], 'position' => .02],
                ['color' => [29, 161, 7], 'position' => .05],
                ['color' => [29, 181, 7], 'position' => .95],
                ['color' => [157, 199, 4], 'position' => .98],
                ['color' => [185, 15, 22], 'position' => .99],
                ['color' => [86, 50, 39], 'position' => 1],
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
                $color_index = (int) round($this->sigmoid($norm_value) * (count($colors) - 1));

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
        return 1 / (1 + exp(-14.7 * ($value - 0.5)));
    }
}
