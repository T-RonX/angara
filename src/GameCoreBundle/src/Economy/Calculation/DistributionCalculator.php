<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Calculation;

/**
 * Layers 2 and 3 (distribution) of the GameFlow model share the same matching
 * rule: a source can only ship its surplus, and only as far as the target's
 * deficit. Both layers are expressed in terms of (Supply - Demand) imbalances.
 *
 * Spreadsheet reference (e.g. C60 inter-object, C66 inter-system):
 *  - Flow(from -> to) = MAX(0, MIN(-ImbalanceTo, ImbalanceFrom))
 *
 * A positive ImbalanceFrom is a surplus; a negative ImbalanceTo is a deficit.
 */
final class DistributionCalculator
{
    public function flow(float $imbalanceFrom, float $imbalanceTo): float
    {
        return max(0.0, min(-$imbalanceTo, $imbalanceFrom));
    }
}

