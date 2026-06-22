<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

/**
 * Layer 4 (global pressure) of the GameFlow model: the world-wide stabilization
 * mechanism that introduces or expires a resource to nudge its global scarcity
 * index towards the desired one.
 *
 * Spreadsheet reference (rows 72/73, columns C/D/E/F/G):
 *  - ScarcityIndex E = MAX(-1, MIN(1, TotalImbalance / MAX(TotalDemand, 0.001)))
 *  - Pressure      F = ScarcityIndex - DesiredScarcityIndex
 *  - Nudge         G = -(Pressure * TotalDemand)
 *  - Introduce     C = MAX(0,  Nudge)
 *  - Expire        D = MAX(0, -Nudge)
 */
final class PressureCalculator
{
    private const float DEMAND_FLOOR = 0.001;

    public function scarcityIndex(float $totalImbalance, float $totalDemand): float
    {
        return max(-1.0, min(1.0, $totalImbalance / max($totalDemand, self::DEMAND_FLOOR)));
    }

    public function pressure(float $scarcityIndex, float $desiredScarcityIndex): float
    {
        return $scarcityIndex - $desiredScarcityIndex;
    }

    public function nudge(float $pressure, float $totalDemand): float
    {
        return -($pressure * $totalDemand);
    }

    public function introduce(float $nudge): float
    {
        return max(0.0, $nudge);
    }

    public function expire(float $nudge): float
    {
        return max(0.0, -$nudge);
    }
}

