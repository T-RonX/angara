<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Contract;

use App\GameCoreBundle\Economy\Material\PricedMaterialInterface;
use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;

/**
 * A raw resource (the "R" of GameFlow): something that is extracted/harvested from
 * a celestial body. Beyond market pricing it has a {@see RawMaterialType}.
 */
interface ResourceInterface extends PricedMaterialInterface
{
    public function getRawType(): RawMaterialType;
}

