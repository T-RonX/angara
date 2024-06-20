<?php

declare(strict_types=1);

namespace App\Game\Map\Generator\Planet;

use GdImage;
use RuntimeException as Exception;

class PlanetGenerator
{
    public function generate(string $sourcePath, string $destinationPath, $size = 200)
    {
        $direction = [
            -30,    // X from center
            -30,    // Y from center
            50      // Distance
        ];

        $this->normalize($direction);

        $image = $this->createSurfaceCircle($size, $sourcePath);
        $image = $this->createSphereLighting($size / 2, 1.5, 0.1, 190, $direction, $image);

        imagepng($image, $destinationPath);
    }

    private function createSurfaceCircle(int $size, $inputImagePath): GdImage
    {
        // Load the existing image
        $srcImage = imagecreatefrompng($inputImagePath);

        if (!$srcImage)
        {
            throw new Exception("Failed to load the image: $inputImagePath");
        }

        $srcImage = imagescale($srcImage, $size, $size);

        // Get the width and height of the source image
        $width = imagesx($srcImage);
        $height = imagesy($srcImage);

        // Use the $size parameter to determine the diameter
        $diameter = min($width, $height, $size);  // Ensures diameter doesn't exceed desired size

        // Create a new true color image with transparent background, respecting size
        $destImage = imagecreatetruecolor($diameter, $diameter);
        imagealphablending($destImage, false);
        imagesavealpha($destImage, true);

        // Fill the new image with transparent color
        $transparentColor = imagecolorallocatealpha($destImage, 0, 0, 0, 127);
        imagefill($destImage, 0, 0, $transparentColor);

        // Create a circular mask
        $mask = imagecreatetruecolor($diameter, $diameter);
        imagealphablending($mask, false);
        imagesavealpha($mask, true);
        imagefill($mask, 0, 0, $transparentColor);

        // Draw a white circle on the mask
        $white = imagecolorallocate($mask, 255, 255, 255);
        imagefilledellipse($mask, $diameter / 2, $diameter / 2, $diameter, $diameter, $white);

        // Copy the circle area from the source image to the destination image
        for ($x = 0; $x < $diameter; $x++)
        {
            for ($y = 0; $y < $diameter; $y++)
            {
                $alpha = (imagecolorat($mask, $x, $y) >> 24) & 0x7F;

                if ($alpha < 127)
                {
                    $color = imagecolorat($srcImage, $x + ($width - $diameter) / 2, $y + ($height - $diameter) / 2);
                    imagesetpixel($destImage, $x, $y, $color);
                }
            }
        }

        return $destImage;
    }

    private function createSphereLighting(int $radius, float $lightFalloff, float $ambient, int $maxLuminosity, array $direction, GdImage $image): GdImage
    {
        imagealphablending($image, true);
        imagesavealpha($image, true);

        $transparent = imagecolorallocatealpha($image, 255, 255, 255, 127);

        imagefill($image, 0, 0, $transparent);

        for ($x = -$radius; $x < $radius; $x++)
        {
            for ($y = -$radius; $y < $radius; $y++)
            {
                $z = $radius * $radius - $x * $x - $y * $y;

                if ($z >= 0)
                {
                    $vector = [$x, $y, sqrt($z)];
                    $this->normalize($vector);
                    $light = $this->dot($direction, $vector);
                    $light = max(0, $light);
                    $luminance = (int) ($maxLuminosity * (($light ** $lightFalloff) + $ambient) / (1 + $ambient));
                    $distanceFromMiddleGray = abs($luminance - 128);
                    $alpha = 127 - $distanceFromMiddleGray;
                    $color = imagecolorallocatealpha($image, $luminance, $luminance, $luminance, $alpha);
                    imagesetpixel($image, $x + $radius, $y + $radius, $color);
                }
            }
        }

        return $image;
    }

    private function normalize(array &$vector): void
    {
        $lengthSq = 0;

        foreach ($vector as $val)
        {
            $lengthSq += $val * $val;
        }

        $invLen = 1 / sqrt($lengthSq);

        foreach ($vector as &$val)
        {
            $val *= $invLen;
        }
    }

    private function dot(array $x, array $y): float
    {
        $result = 0;

        for ($i = 0; $i < 3; $i++)
        {
            $result += $x[$i] * $y[$i];
        }

        return $result;
    }
}
