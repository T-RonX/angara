<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Command;

use App\GameCoreBundle\Economy\Tick\EconomyTicker;
use App\GameCoreBundle\Economy\Tick\Exception\WorldNotFoundException;
use App\GameCoreBundle\Economy\Tick\TickReportRenderer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:economy:tick',
    description: 'Advances the economy of a world by one or more ticks, applying the full GameFlow model.',
)]
final class EconomyTickCommand extends Command
{
    private const string DEFAULT_WORLD_IDENTIFIER = 'angara';

    public function __construct(
        private readonly EconomyTicker $economyTicker,
        private readonly TickReportRenderer $reportRenderer,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('world', InputArgument::OPTIONAL, 'World identifier to tick.', self::DEFAULT_WORLD_IDENTIFIER)
            ->addOption('ticks', 't', InputOption::VALUE_REQUIRED, 'Number of ticks to run.', 1)
            ->addOption('no-report', 'R', InputOption::VALUE_NONE, 'Skip rendering the per-tick report tables (recommended for large worlds / scheduled ticking).');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $worldIdentifier = (string) $input->getArgument('world');
        $ticks = max(1, (int) $input->getOption('ticks'));
        $renderReport = !$input->getOption('no-report');

        try
        {
            for ($i = 0; $i < $ticks; $i++)
            {
                $report = $this->economyTicker->tick($worldIdentifier, $renderReport);

                if ($renderReport)
                {
                    $this->reportRenderer->render($io, $report);
                }
            }
        }
        catch (WorldNotFoundException $exception)
        {
            $io->error($exception->getMessage());
            $io->note('Seed the world first with: make fixtures');

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}

