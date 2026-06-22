<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

/**
 * A material that carries its own market pricing inputs (the GameFlow "Resources
 * properties"). Raw resources and refined goods are priced this way; components
 * are not, since their cost is derived at runtime from their recipe.
 */
interface PricedMaterialInterface extends MaterialInterface
{
    public function getDesiredScarcityIndex(): float;

    public function getBasePrice(): float;

    public function getPriceScarcitySensitivity(): float;
}

