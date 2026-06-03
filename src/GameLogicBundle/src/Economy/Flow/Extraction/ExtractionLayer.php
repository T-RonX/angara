<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Flow\Extraction;

use App\GameLogicBundle\Economy\Flow\TickableInterface;
use App\GameLogicBundle\Economy\Material\Materials;
use App\GameLogicBundle\World\World;

class ExtractionLayer implements TickableInterface
{
    public function __construct(
        readonly private Materials $materials,
        readonly private World $world,
    ) {
    }

    public function tick(): void
    {
        $this->materials->all['iron'];
        $this->materials->processesByOutput['electrolyte'];
        $this->materials->processesByInput['wood'];


    }
}
