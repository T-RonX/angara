<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Evolution;

/**
 * The computed next-tick persistent state of a single {@see
 * \App\GameCoreBundle\World\Entity\CelestialBodyResource}, identified by its
 * primary key. Produced by {@see \App\GameCoreBundle\Economy\Tick\Evolution\StateEvolver}
 * and written in bulk by {@see ResourceStateWriter} — no managed entity is
 * mutated, so the write path stays out of the Doctrine UnitOfWork.
 */
final readonly class ResourceStateChange
{
    public function __construct(
        public int $resourceId,
        public float $reserves,
        public float $stock,
    ) {
    }
}
