<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material\Type\Raw;

use App\GameLogicBundle\Economy\Contract\ResourceInterface;
use App\GameLogicBundle\Economy\Material\AbstractMaterial;
use App\GameLogicBundle\Economy\Material\Type\MaterialType;
use App\GameLogicBundle\Economy\Material\Type\RawMaterialType;

class AbstractRaw extends AbstractMaterial implements ResourceInterface
{
    public function __construct(
        string $identifier,
        readonly public protected(set) RawMaterialType $rawType,
        float $scarcityIndex = self::DEFAULT_SCARCITY_INDEX,
        float $basePrice = self::DEFAULT_BASE_PRICE,
        float $priceScarcitySensitivity = self::DEFAULT_PRICE_SCARCITY_SENSITIVITY,
        float $storageDecayRate = self::DEFAULT_STORAGE_DECAY_RATE,
    ) {
        parent::__construct(
            $identifier,
            MaterialType::Raw,
            $scarcityIndex,
            $basePrice,
            $priceScarcitySensitivity,
            $storageDecayRate
        );
    }
}
