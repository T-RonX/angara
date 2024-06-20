<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

use App\Game\Map\Generator\MapDescriptor\Gradiant\ColorGradiant;
use App\Game\Map\Generator\MapDescriptor\Gradiant\ColorRgb;
use App\Game\Map\Generator\MapDescriptor\Gradiant\GradiantStop;
use App\Game\Map\Generator\MapDescriptor\MapDescriptor;
use App\Game\Map\Generator\Planet\PlanetGenerator;
use MapGenerator\PerlinNoiseGenerator;
use SplFixedArray;
use InvalidArgumentException;
use Symfony\Component\DependencyInjection\Attribute\AutowireInline;

class MapGenerator
{
    private MapDescriptor $mapDescriptor;

    public function __construct(
        #[AutowireInline(class: PerlinNoiseGenerator::class)] private readonly PerlinNoiseGenerator $perlinNoiseGenerator,
        private readonly PlanetGenerator $planetGenerator,
        private readonly MapTiler $mapTiler,
        private readonly MapDecorator $mapDecorator,
    ) {
    }

    public function generate(?string $seed, MapDescriptor $mapDescriptor, bool $thumbnail = true): array
    {
        $targetFile = '/var/www/html/src/map.png';
        $this->mapDescriptor = $mapDescriptor;

        ini_set('memory_limit', '-1');

        $size = $this->mapDescriptor->getSize();

        $this->perlinNoiseGenerator->setPersistence($this->mapDescriptor->getRoughness());
        $this->perlinNoiseGenerator->setSize($size);

        if ($seed)
        {
            $this->perlinNoiseGenerator->setMapSeed($seed);
        }

        $map = $this->perlinNoiseGenerator->generate();
        $mapColor = $this->createImage($size, $map, $targetFile);

        $this->mapDecorator->decorate($targetFile, $mapDescriptor);

        if ($thumbnail === true)
        {
            $this->planetGenerator->generate($targetFile, '/var/www/html/src/map_planet.png', $this->mapDescriptor->getSize());
        }

        $this->mapTiler->tile($targetFile, 100);

        return $mapColor;
    }

    /**
     * @return array
     */
    private function getColorGradient(ColorGradiant $colorGradiant): array
    {
        // Validate input
        if ($colorGradiant->getColorCount() < 3)
        {
            throw new InvalidArgumentException('Color count must be greater than or equal to 3');
        }

        // Validate control points
        $numControlPoints = count($colorGradiant->getStops());

        if ($numControlPoints < 2)
        {
            throw new InvalidArgumentException('Control points array must contain at least two elements');
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


    private function createImage(int $size, SplFixedArray $map, $destinationPath): array
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

        $colors = $this->getColorGradient($this->mapDescriptor->getElevationColorGradiant());

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

        @unlink($destinationPath);
        imagepng($image, $destinationPath);
        imagedestroy($image);

        return $mapColors;
    }

    private function sigmoid($value): float
    {
        // -12 to -20
        return 1 / (1 + exp($this->mapDescriptor->getElevationLevel() * ($value - 0.5)));
    }
}
