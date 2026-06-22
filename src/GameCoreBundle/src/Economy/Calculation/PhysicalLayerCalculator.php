<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;

/**
 * Layer 0 (physical) of the GameFlow model: how much of a resource a celestial
 * body can yield this tick from its reserves, regeneration and extraction rate.
 *
 * Spreadsheet reference (rows 15/16, columns E/F/G):
 *  - Supply        E = MIN(ExtractRate, RegenRate + Reserves)
 *  - DepletionRate F = ExtractRate - RegenRate
 *  - TicksLeft     G = (Reserves [+ RegenRate for deposits]) / DepletionRate
 */
final class PhysicalLayerCalculator
{
    public function supply(float $extractRate, float $regenRate, float $reserves): float
    {
        return min($extractRate, $regenRate + $reserves);
    }

    public function depletionRate(float $extractRate, float $regenRate): float
    {
        return $extractRate - $regenRate;
    }

    public function ticksLeft(RawMaterialType $type, float $reserves, float $regenRate, float $depletionRate): float
    {
        if ($depletionRate === 0.0)
        {
            return INF;
        }

        // Deposits count the regenerated amount towards their longevity (G15 = (B+C)/F),
        // flow resources only count their standing reserves (G16 = B/F).
        $numerator = $type === RawMaterialType::Deposit
            ? $reserves + $regenRate
            : $reserves;

        return $numerator / $depletionRate;
    }
}

