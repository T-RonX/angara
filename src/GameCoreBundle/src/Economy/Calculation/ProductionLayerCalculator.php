<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

/**
 * Layer 1 (production / storage) of the GameFlow model: how the physical supply
 * meets a celestial body's storage and demand.
 *
 * Spreadsheet reference (rows 26/27, columns C/D/E/G/H/I):
 *  - Stock (decayed) C = RawStock * (1 - StorageDecayRate)
 *  - Supply          E = MIN(Layer0Supply, Capacity - Stock)
 *  - TicksToFull/Empty D = IF((Supply-Demand) > 0, (Capacity-Stock)/(Supply-Demand), Stock/ABS(Supply-Demand))
 *  - Surplus         G = MAX(0, Supply - Demand)
 *  - Deficit         H = MAX(0, Demand - Supply)
 *  - Imbalance       I = Supply - Demand
 */
final class ProductionLayerCalculator
{
    public function decayedStock(float $rawStock, float $storageDecayRate): float
    {
        return $rawStock * (1 - $storageDecayRate);
    }

    public function supply(float $layer0Supply, float $storageCapacity, float $decayedStock): float
    {
        return min($layer0Supply, $storageCapacity - $decayedStock);
    }

    public function surplus(float $supply, float $demand): float
    {
        return max(0, $supply - $demand);
    }

    public function deficit(float $supply, float $demand): float
    {
        return max(0, $demand - $supply);
    }

    public function imbalance(float $supply, float $demand): float
    {
        return $supply - $demand;
    }

    public function ticksToFullOrEmpty(float $storageCapacity, float $decayedStock, float $supply, float $demand): float
    {
        $net = $supply - $demand;

        if ($net > 0)
        {
            return ($storageCapacity - $decayedStock) / $net;
        }

        if ($net === 0.0)
        {
            return INF;
        }

        return $decayedStock / abs($net);
    }
}

