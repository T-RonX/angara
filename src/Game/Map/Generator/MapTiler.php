<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

class MapTiler
{
    public function tile(string $sourcePath, int $size): array
    {
        // Get image information
        $sourcePathInfo = getimagesize($sourcePath);
        if (!$sourcePathInfo) {
            throw new Exception('Failed to get image information.');
        }

        $originalImageWidth = $sourcePathInfo[0];
        $originalImageHeight = $sourcePathInfo[1];

        // Calculate number of tiles
        $numTilesX = ceil($originalImageWidth / $size);
        $numTilesY = ceil($originalImageHeight / $size);

        // Open original image
        $originalImage = imagecreatefromstring(file_get_contents($sourcePath));
        if (!$originalImage) {
            throw new Exception('Failed to open image.');
        }

        // Loop through each tile
        for ($y = 0; $y < $numTilesY; $y++) {
            for ($x = 0; $x < $numTilesX; $x++) {

                // Define tile coordinates within original image
                $startX = $x * $size;
                $startY = $y * $size;

                // Calculate actual tile width and height (might be smaller for edge tiles)
                $tileWidthActual = min($size, $originalImageWidth - $startX);
                $tileHeightActual = min($size, $originalImageHeight - $startY);

                // Create a new image for the tile
                $tileImage = imagecreatetruecolor($tileWidthActual, $tileHeightActual);

                // Copy a portion of the original image to the tile
                imagecopy($tileImage, $originalImage, 0, 0, $startX, $startY, $tileWidthActual, $tileHeightActual);

                // Generate filename for the tile
                $tileFilename = sprintf('%s/tile_%d_%d.%s', dirname($sourcePath), $x, $y, pathinfo($sourcePath)['extension']);

                // Save the tile image
                $success = imagepng($tileImage, $tileFilename);
                imagedestroy($tileImage);

                if (!$success)
                {
                    throw new Exception('Failed to save tile image.');
                }
            }
        }

        // Free memory
        imagedestroy($originalImage);

        return [];
    }
}