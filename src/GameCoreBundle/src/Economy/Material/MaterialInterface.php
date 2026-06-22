<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

use App\GameCoreBundle\Economy\Material\Type\MaterialType;

/**
 * The properties every material shares, regardless of its kind. Anything that can
 * be stored can decay, so {@see getStorageDecayRate()} lives here; pricing lives
 * on {@see PricedMaterialInterface}.
 */
interface MaterialInterface
{
    public function getIdentifier(): string;

    public function getType(): MaterialType;

    public function getStorageDecayRate(): float;
}

