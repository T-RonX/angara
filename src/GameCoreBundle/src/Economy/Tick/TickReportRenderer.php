<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick;

use App\GameCoreBundle\Economy\Tick\Report\TickReport;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Renders a {@see TickReport} as console tables, one section per GameFlow layer.
 */
final class TickReportRenderer
{
    public function render(SymfonyStyle $io, TickReport $report): void
    {
        $io->title(sprintf('World "%s" - tick %d', $report->worldIdentifier, $report->tick));

        $io->section('Layer 0/1 - physical & production (per celestial body)');
        $io->table(
            ['System', 'Body', 'Resource', 'Phys. supply', 'Depletion', 'Ticks left', 'Stock', 'Supply', 'Demand', 'Surplus', 'Deficit', 'Imbalance', 'Ticks full/empty'],
            array_map(
                static fn ($state): array => [
                    $state->systemIdentifier,
                    $state->bodyIdentifier,
                    $state->materialIdentifier,
                    self::number($state->physicalSupply),
                    self::number($state->depletionRate),
                    self::number($state->ticksLeft),
                    self::number($state->decayedStock),
                    self::number($state->supply),
                    self::number($state->demand),
                    self::number($state->surplus),
                    self::number($state->deficit),
                    self::number($state->imbalance),
                    self::number($state->ticksToFullOrEmpty),
                ],
                $report->bodyStates,
            ),
        );

        $io->section('System summary - local scarcity & price');
        $io->table(
            ['System', 'Resource', 'Supply', 'Demand', 'Imbalance', 'Local SI', 'Local price'],
            array_map(
                static fn ($summary): array => [
                    $summary->systemIdentifier,
                    $summary->materialIdentifier,
                    self::number($summary->supply),
                    self::number($summary->demand),
                    self::number($summary->imbalance),
                    self::number($summary->localScarcityIndex),
                    self::number($summary->localPrice),
                ],
                $report->systemSummaries,
            ),
        );

        if ($report->flows !== [])
        {
            $io->section('Layer 2/3 - distribution (applied flows)');
            $io->table(
                ['Scope', 'Resource', 'From', 'To', 'Amount'],
                array_map(
                    static fn ($flow): array => [
                        $flow->scope->value,
                        $flow->materialIdentifier,
                        $flow->fromIdentifier,
                        $flow->toIdentifier,
                        self::number($flow->amount),
                    ],
                    $report->flows,
                ),
            );
        }

        $io->section('Layer 4 - global pressure');
        $io->table(
            ['Resource', 'Supply', 'Demand', 'Imbalance', 'SI', 'Desired SI', 'Pressure', 'Nudge', 'Introduce', 'Expire'],
            array_map(
                static fn ($pressure): array => [
                    $pressure->materialIdentifier,
                    self::number($pressure->totalSupply),
                    self::number($pressure->totalDemand),
                    self::number($pressure->totalImbalance),
                    self::number($pressure->scarcityIndex),
                    self::number($pressure->desiredScarcityIndex),
                    self::number($pressure->pressure),
                    self::number($pressure->nudge),
                    self::number($pressure->introduce),
                    self::number($pressure->expire),
                ],
                $report->pressures,
            ),
        );
    }

    private static function number(float $value): string
    {
        if (is_infinite($value))
        {
            return $value > 0 ? 'INF' : '-INF';
        }

        return rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.');
    }
}





