<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Flow;

interface TickableInterface
{
    public function tick(): void;
}
