<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Computation;

use App\GameCoreBundle\Economy\Calculation\PhysicalLayerCalculator;
use App\GameCoreBundle\Economy\Calculation\ProductionLayerCalculator;
use App\GameCoreBundle\Economy\Contract\ResourceInterface;
use App\GameCoreBundle\Economy\Material\Materials;
use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;
use App\GameCoreBundle\Economy\Tick\Input\ResourceTickRow;

/**
 * Computes the deterministic Layer 0/1 result and base next-tick state of a single
 * resource from its flat input row, resolving static material properties (decay,
 * raw type) from the cached material catalog by identifier.
 *
 * This is the single source of truth for the per-resource math shared by both
 * streaming passes of a tick, so the aggregation and the evolution can never drift
 * apart.
 */
final class ResourceTickComputer
{
    public function __construct(
        private readonly Materials $materials,
        private readonly PhysicalLayerCalculator $physical,
        private readonly ProductionLayerCalculator $production,
    ) {
    }

    public function compute(ResourceTickRow $row): ComputedResource
    {
        $material = $this->materials->get($row->materialIdentifier);
        $rawType = $material instanceof ResourceInterface ? $material->getRawType() : RawMaterialType::Deposit;
        $decayRate = $material?->getStorageDecayRate() ?? 0.0;

        // Layer 0 (physical)
        $physicalSupply = $this->physical->supply($row->extractRate, $row->regenRate, $row->reserves);
        $depletionRate = $this->physical->depletionRate($row->extractRate, $row->regenRate);
        $ticksLeft = $this->physical->ticksLeft($rawType, $row->reserves, $row->regenRate, $depletionRate);

        // Layer 1 (production)
        $decayedStock = $this->production->decayedStock($row->stock, $decayRate);
        $supply = $this->production->supply($physicalSupply, $row->storageCapacity, $decayedStock);
        $demand = $row->demand;
        $surplus = $this->production->surplus($supply, $demand);
        $deficit = $this->production->deficit($supply, $demand);
        $imbalance = $this->production->imbalance($supply, $demand);
        $ticksToFullOrEmpty = $this->production->ticksToFullOrEmpty($row->storageCapacity, $decayedStock, $supply, $demand);

        // Base next-tick state (pre-pressure): reserves deplete, stock decays,
        // is produced into and consumed by demand, bounded to storage capacity.
        $baseReserves = max(0.0, $row->reserves - $depletionRate);
        $baseStock = $this->clamp($decayedStock + $supply - $demand, 0.0, $row->storageCapacity);
        $free = $row->storageCapacity - $baseStock;

        return new ComputedResource(
            $physicalSupply,
            $depletionRate,
            $ticksLeft,
            $decayedStock,
            $supply,
            $demand,
            $surplus,
            $deficit,
            $imbalance,
            $ticksToFullOrEmpty,
            $baseReserves,
            $baseStock,
            $free,
        );
    }

    private function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
