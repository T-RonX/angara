<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

use App\GameLogicBundle\Economy\Material\Type\MaterialType;
use App\GameLogicBundle\Economy\Material\Type\RawMaterialType;

abstract class AbstractMaterial
{
    public const float DEFAULT_SCARCITY_INDEX = 0;
    public const float DEFAULT_BASE_PRICE = 1;
    public const float DEFAULT_PRICE_SCARCITY_SENSITIVITY = 0.5;
    public const float DEFAULT_STORAGE_DECAY_RATE = 0;

    public function __construct(
        readonly public protected(set) string $identifier,
        readonly public protected(set) MaterialType $type,
        readonly public protected(set) float $scarcityIndex = self::DEFAULT_SCARCITY_INDEX,
        readonly public protected(set) float $basePrice = self::DEFAULT_BASE_PRICE,
        readonly public protected(set) float $priceScarcitySensitivity = self::DEFAULT_PRICE_SCARCITY_SENSITIVITY,
        readonly public protected(set) float $storageDecayRate = self::DEFAULT_STORAGE_DECAY_RATE,
    ) {
    }
}
