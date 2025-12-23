<?php


declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet;

use SplFixedArray;

class Body
{
    public function __construct(
        readonly public SplFixedArray $terrainMap,
        readonly public SplFixedArray $bordersMap,
        readonly public SplFixedArray $resourceMap,
    ) {
    }
}
