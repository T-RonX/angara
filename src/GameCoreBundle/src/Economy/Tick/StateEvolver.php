<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use App\GameCoreBundle\World\Entity\CelestialBodyResource;
use App\GameCoreBundle\World\Entity\System;
use App\GameCoreBundle\World\Entity\World;

/**
 * Applies a {@see TickReport} to the persistent world, evolving its state for
 * the next tick:
 *
 *  1. Physical + production: reserves deplete, stock decays, is produced into
 *     and consumed by demand (Layers 0 and 1).
 *  2. Pressure: the world introduces or expires the resource to stabilize its
 *     global scarcity index (Layer 4).
 *
 * The distribution flows (Layers 2 and 3) are reported but, for now, deliberately
 * NOT applied to the persistent state — they are informational only.
 */
final class StateEvolver
{
    public function apply(World $world, TickReport $report): void
    {
        $this->applyPhysicalAndProduction($world, $report);
        $this->applyPressure($world, $report);
    }

    private function applyPhysicalAndProduction(World $world, TickReport $report): void
    {
        foreach ($world->getSystems() as $system)
        {
            foreach ($system->getCelestialBodies() as $body)
            {
                foreach ($body->getResources() as $resource)
                {
                    $state = null;
                    foreach ($report->bodyStates as $candidate)
                    {
                        if ($candidate->systemIdentifier === $system->getIdentifier()
                            && $candidate->bodyIdentifier === $body->getIdentifier()
                            && $candidate->materialIdentifier === $resource->getMaterialIdentifier())
                        {
                            $state = $candidate;
                            break;
                        }
                    }

                    if ($state === null)
                    {
                        continue;
                    }

                    // Reserves are drawn down by the depletion rate (a negative
                    // depletion, i.e. regen > extraction, lets them recover).
                    $resource->setReserves(max(0.0, $resource->getReserves() - $state->depletionRate));

                    // Stock decays, receives this tick's supply and is consumed
                    // by demand, bounded to the storage capacity.
                    $newStock = $state->decayedStock + $state->supply - $state->demand;
                    $resource->setStock($this->clamp($newStock, 0.0, $resource->getStorageCapacity()));
                }
            }
        }
    }


    private function applyPressure(World $world, TickReport $report): void
    {
        foreach ($report->pressures as $pressure)
        {
            $resources = $this->resourcesOfWorld($world, $pressure->materialIdentifier);

            if ($pressure->introduce > 0.0)
            {
                $this->addStock($resources, $pressure->introduce);
            }

            if ($pressure->expire > 0.0)
            {
                $this->removeStock($resources, $pressure->expire);
            }
        }
    }


    /**
     * Distributes an addition across resources proportionally to their free
     * storage space, never exceeding capacity. Returns the amount actually added.
     *
     * @param CelestialBodyResource[] $resources
     */
    private function addStock(array $resources, float $amount): float
    {
        $totalFree = 0.0;
        foreach ($resources as $resource)
        {
            $totalFree += max(0.0, $resource->getStorageCapacity() - $resource->getStock());
        }

        if ($totalFree <= 0.0 || $amount <= 0.0)
        {
            return 0.0;
        }

        $applied = 0.0;
        foreach ($resources as $resource)
        {
            $free = max(0.0, $resource->getStorageCapacity() - $resource->getStock());
            $share = min($free, $amount * ($free / $totalFree));
            $resource->setStock($resource->getStock() + $share);
            $applied += $share;
        }

        return $applied;
    }

    /**
     * Distributes a removal across resources proportionally to their stock,
     * never going below zero. Returns the amount actually removed.
     *
     * @param CelestialBodyResource[] $resources
     */
    private function removeStock(array $resources, float $amount): float
    {
        $totalStock = 0.0;
        foreach ($resources as $resource)
        {
            $totalStock += $resource->getStock();
        }

        if ($totalStock <= 0.0 || $amount <= 0.0)
        {
            return 0.0;
        }

        $applied = 0.0;
        foreach ($resources as $resource)
        {
            $share = min($resource->getStock(), $amount * ($resource->getStock() / $totalStock));
            $resource->setStock($resource->getStock() - $share);
            $applied += $share;
        }

        return $applied;
    }


    /**
     * @return CelestialBodyResource[]
     */
    private function resourcesOfSystem(System $system, string $materialIdentifier): array
    {
        $resources = [];

        foreach ($system->getCelestialBodies() as $body)
        {
            $resource = $body->getResource($materialIdentifier);
            if ($resource !== null)
            {
                $resources[] = $resource;
            }
        }

        return $resources;
    }

    /**
     * @return CelestialBodyResource[]
     */
    private function resourcesOfWorld(World $world, string $materialIdentifier): array
    {
        $resources = [];

        foreach ($world->getSystems() as $system)
        {
            $resources = [...$resources, ...$this->resourcesOfSystem($system, $materialIdentifier)];
        }

        return $resources;
    }

    private function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}

