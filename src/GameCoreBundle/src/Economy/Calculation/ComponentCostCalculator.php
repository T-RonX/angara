<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

use App\GameCoreBundle\Economy\Material\MaterialProcess;

/**
 * "Component cost" of the GameFlow model: the runtime cost of producing a
 * compound, evaluated against the local prices of its inputs.
 *
 * Spreadsheet reference (rows 54/55): Cost = SUM(InputQuantity * LocalPrice(input)).
 */
final class ComponentCostCalculator
{
    /**
     * @param array<string, float> $localPrices local price per input material identifier
     */
    public function cost(MaterialProcess $process, array $localPrices): float
    {
        $cost = 0.0;

        foreach ($process->inputs->inputs as $input)
        {
            $cost += $input->quantity * ($localPrices[$input->materialIdentifier] ?? 0.0);
        }

        return $cost;
    }
}

