<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Tiling;

use App\Game\Environment\Generator\Planet\Decorator\TerrainDecorator;
use App\Game\Environment\Generator\Planet\Terrain\MapDescriptor;
use Exception;

class TerrainTiler
{
    public function __construct(
        private readonly TerrainDecorator $terrainDecorator,
        private readonly string $appRootDir,
    ) {
    }

    public function tile(MapDescriptor $mapDescriptor, array $terrain, int $pixelsPerTile, int $pixelSize): array
    {
        // Get image information
        $mapSize = count($terrain);

        // Calculate number of tiles
        $numTiles = (int) ceil($mapSize / $pixelsPerTile);

        // Loop through each tile
        for ($y = 0; $y < $numTiles; ++$y)
        {
            for ($x = 0; $x < $numTiles; ++$x)
            {
                $startX = $x * $pixelsPerTile;
                $startY = $y * $pixelsPerTile;

                $tileSize = min($pixelsPerTile * $pixelSize, $mapSize * $pixelSize - $startX);

                $tilePixels = [];

                for ($p = $startY; $p < $startY + $pixelsPerTile; ++$p)
                {
                    $tilePixels[] = array_slice($terrain[$p], $startX, $pixelsPerTile);
                }

                $image = imagecreatetruecolor($tileSize, $tileSize);

                for ($py = 0; $py < $pixelsPerTile; ++$py)
                {
                    for ($px = 0; $px < $pixelsPerTile; ++$px)
                    {
                        $color = imagecolorallocate($image, ...$tilePixels[$py][$px]->getColor()->toArray());
                        imagefilledrectangle($image, $px * $pixelSize, $py * $pixelSize, $px * $pixelSize + $pixelSize, $py * $pixelSize + $pixelSize, $color);
                    }
                }

                $tileFilename = sprintf('%s/tile_%d_%d.%s', $this->appRootDir . '/tmp/map/', $y, $x, 'webp');

                $this->terrainDecorator->decorate($image, $mapDescriptor);

                // Save the tile image
                $success = imagewebp($image, $tileFilename, IMG_WEBP_LOSSLESS);
                imagedestroy($image);

                if (!$success)
                {
                    throw new Exception('Failed to save tile image.');
                }

            }
        }

        return [];
    }
}
