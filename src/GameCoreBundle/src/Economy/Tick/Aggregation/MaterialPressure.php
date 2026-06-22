<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Aggregation;

/**
 * The Layer 4 pressure distribution for one material, accumulated during the
 * aggregation pass so the evolution pass can apply it per resource without holding
 * any per-body state in memory.
 *
 * {@see introduce} and {@see expire} are mutually exclusive (they are the positive
 * and negative halves of the same nudge), and {@see totalFree} / {@see totalStock}
 * are the world-wide denominators the per-resource share is proportional to.
 */
final readonly class MaterialPressure
{
    public function __construct(
        public float $introduce,
        public float $expire,
        public float $totalFree,
        public float $totalStock,
    ) {
    }
}
