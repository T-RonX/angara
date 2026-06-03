<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Flow;

class Tick
{
    /** @var TickableInterface[] */
    public function __construct(
        readonly public private(set) array $tickables,
    ) {
    }
}
