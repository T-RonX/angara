<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;

class TerrainProperties
{
    public ColorRgb $color;

    public function __construct(
        readonly private(set) string $id,
    ) {
    }
}
