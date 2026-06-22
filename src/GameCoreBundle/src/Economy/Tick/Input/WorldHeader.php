<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Input;

/**
 * Minimal identity of a world for ticking: its primary key and current tick. Read
 * directly so the tick path touches no ORM-managed entities.
 */
final readonly class WorldHeader
{
    public function __construct(
        public int $id,
        public int $tick,
    ) {
    }
}
