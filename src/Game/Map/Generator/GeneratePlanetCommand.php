<?php

declare(strict_types=1);

namespace App\Game\Map\Generator;

use App\Game\Map\Generator\Planet\PlanetGenerator;
use RuntimeException as Exception;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use GdImage;

class GeneratePlanetCommand extends Command
{
    public function __construct(
        private readonly PlanetGenerator $planetGenerator
    ) {
        parent::__construct();
    }

    public function configure()
    {
        $this->setName('angara:planet:generate');
    }

    public function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->planetGenerator->generate('/var/www/html/src/map.png', '/var/www/html/src/map_planet.png', 200);

        return 0;
    }
}
