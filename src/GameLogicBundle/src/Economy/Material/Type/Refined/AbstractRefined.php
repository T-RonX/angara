<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material\Type\Refined;

use App\GameLogicBundle\Economy\Contract\CompoundInterface;
use App\GameLogicBundle\Economy\Material\AbstractMaterial;
use App\GameLogicBundle\Economy\Material\Type\MaterialType;
use App\GameLogicBundle\Economy\Material\Type\RawMaterialType;

class AbstractRefined extends AbstractMaterial implements CompoundInterface
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
            MaterialType::Refined,
            $scarcityIndex,
            $basePrice,
            $priceScarcitySensitivity,
            $storageDecayRate
        );
    }
}
