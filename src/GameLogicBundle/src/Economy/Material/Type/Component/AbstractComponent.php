<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material\Type\Component;

use App\GameLogicBundle\Economy\Contract\CompoundInterface;
use App\GameLogicBundle\Economy\Material\AbstractMaterial;
use App\GameLogicBundle\Economy\Material\Type\MaterialType;

class AbstractComponent extends AbstractMaterial implements CompoundInterface
{
    public function __construct(
        string $identifier,
        float $scarcityIndex = self::DEFAULT_SCARCITY_INDEX,
        float $basePrice = self::DEFAULT_BASE_PRICE,
        float $priceScarcitySensitivity = self::DEFAULT_PRICE_SCARCITY_SENSITIVITY,
        float $storageDecayRate = self::DEFAULT_STORAGE_DECAY_RATE,
    ) {
        parent::__construct(
            $identifier,
            MaterialType::Component,
            $scarcityIndex,
            $basePrice,
            $priceScarcitySensitivity,
            $storageDecayRate
        );
    }
}
