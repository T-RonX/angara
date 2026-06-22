<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

/**
 * "Exchange rates" of the GameFlow model: how much of one resource one unit of
 * another is worth, given two local prices.
 *
 * Spreadsheet reference (rows 42-45): Rate = OfferedPrice / ReceivedPrice.
 */
final class ExchangeRateCalculator
{
    public function rate(float $offeredPrice, float $receivedPrice): float
    {
        if ($receivedPrice === 0.0)
        {
            return INF;
        }

        return $offeredPrice / $receivedPrice;
    }
}

