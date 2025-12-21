<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Command;

use App\Game\Game\Environment\Generator\Planet\Terrain\StyleProvider;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

enum Tile: int
{
    case TL = 1;
    case TM = 2;
    case TR = 4;
    case ML = 8;
    case MR = 16;
    case BL = 32;
    case BM = 64;
    case BR = 128;
}

class GenerateMapDetailCommand extends Command
{
    public function __construct(
        private readonly StyleProvider $styleProvider,
    ) {
        parent::__construct();
    }

    public function configure(): void
    {
        $this->setName('angara:generate:detail');
        $this->addOption('seed', 's', InputOption::VALUE_OPTIONAL);
    }

    public function execute(InputInterface $input, OutputInterface $output): int
    {
        /** @var int[] $grids */
        $grids = range(0, 255);

        foreach ($grids as $grid)
        {
            $t = fn (\App\Game\Environment\Command\Tile $tile) => $this->tile($grid, $tile);

            $output->writeln(sprintf('%d:', $grid));
            $output->writeln($t(Tile::TL) . $t(Tile::TM) . $t(Tile::TR));
            $output->writeln($t(Tile::ML) . '◯' . $t(Tile::MR));
            $output->writeln($t(Tile::BL) . $t(Tile::BM) . $t(Tile::BR));

            $output->writeln('');
        }

        return 0;
    }

    private function tile(int $grid, \App\Game\Environment\Command\Tile $tile): string
    {
        return ($grid & $tile->value) === $tile->value ? '◼' : '◻';
    }
}
