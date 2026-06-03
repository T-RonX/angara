<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Flow;

use App\GameLogicBundle\Economy\Flow\Extraction\ExtractionLayer;
use App\GameLogicBundle\Economy\Flow\LocalFlow\LocalFlowLayer;
use App\GameLogicBundle\Economy\Flow\Pressure\PressureLayer;
use App\GameLogicBundle\Economy\Flow\Production\ProductionLayer;
use App\GameLogicBundle\Economy\Flow\Trade\TradeLayer;
use App\SystemBundle\CliAccess\CliAccessInterface;

class Ticker implements CliAccessInterface
{
    /** @var Tick[] */
    private array $ticks = [];

    /** @var TickableInterface[] */
    public function __construct(
        readonly public private(set) ExtractionLayer $extractionLayer,
        readonly public private(set) ProductionLayer $productionLayer,
        readonly public private(set) LocalFlowLayer $localFlowLayer,
        readonly public private(set) TradeLayer $tradeLayer,
        readonly public private(set) PressureLayer $pressureLayer,
    ) {
        $this->ticks[] = new Tick(
            [
                $this->extractionLayer,
                $this->productionLayer,
            ]
        );
        $this->ticks[] = new Tick(
            [
                $this->localFlowLayer
            ],
        );
        $this->ticks[] = new Tick(
            [
                $this->tradeLayer
            ],
        );
        $this->ticks[] = new Tick(
            [
                $this->pressureLayer
            ],
        );
    }

    public function tick(): void
    {
        foreach ($this->ticks as $tick)
        {
            foreach ($tick->tickables as $tickable)
            {
                $tickable->tick();
            }
        }
    }
}
