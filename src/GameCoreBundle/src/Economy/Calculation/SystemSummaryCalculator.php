<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

/**
 * "System summary" of the GameFlow model: aggregates each system's supply and
 * demand into a local scarcity index and a local price.
 *
 * Spreadsheet reference (rows 37/38, columns E/F):
 *  - LocalScarcityIndex E = MAX(-1, MIN(1, Imbalance / MAX(Demand, 0.001)))
 *  - LocalPrice         F = BasePrice * EXP(-ScarcitySensitivity * LocalScarcityIndex)
 */
final class SystemSummaryCalculator
{
    private const float DEMAND_FLOOR = 0.001;

    public function localScarcityIndex(float $imbalance, float $demand): float
    {
        return max(-1.0, min(1.0, $imbalance / max($demand, self::DEMAND_FLOOR)));
    }

    public function localPrice(float $basePrice, float $priceScarcitySensitivity, float $localScarcityIndex): float
    {
        return $basePrice * exp(-$priceScarcitySensitivity * $localScarcityIndex);
    }
}

