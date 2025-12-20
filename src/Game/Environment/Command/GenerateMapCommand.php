<?php

declare(strict_types=1);

namespace App\Game\Environment\Command;

use App\Game\Environment\Generator\Planet\PlanetGenerator;
use App\Game\Environment\Generator\Planet\Terrain\StyleProvider;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

class GenerateMapCommand extends Command
{
    public function __construct(
        private readonly PlanetGenerator $planetGenerator,
        private readonly StyleProvider $styleProvider,
        private readonly string $appRootDir,
    ) {
        parent::__construct();
    }

    public function configure(): void
    {
        $this->setName('angara:generate:planet');
        $this->addOption('seed', 's', InputOption::VALUE_OPTIONAL);
    }

    public function execute(InputInterface $input, OutputInterface $output): int
    {
        $mapDescriptor = $this->styleProvider->getStyle('fictional_5');

        $this->planetGenerator->generate(
            $input->getOption('seed'),
            $mapDescriptor,
            $this->appRootDir . '/tmp/map/' . $input->getOption('seed') . '.webp',
            thumbnail: false,
        );

        return 0;
    }
}
