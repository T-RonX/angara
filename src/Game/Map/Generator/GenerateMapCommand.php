<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

use MapGenerator\PerlinNoiseGenerator;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\ProgressBar;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

class GenerateMapCommand extends Command
{
    public function __construct(
        private MapGenerator $mapGenerator,
    ) {
        parent::__construct();
    }

    public function configure()
    {
        $this->setName('angara:map:generate');
        $this->addOption('seed', 's', InputOption::VALUE_OPTIONAL);
    }

    public function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->mapGenerator->generate($input->getOption('seed'));

        return 1;
    }
}
