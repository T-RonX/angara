<?php

declare(strict_types=1);

namespace App\GameLogicBundle\DependencyInjection;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\File\File;
use Symfony\Component\HttpKernel\DependencyInjection\ConfigurableExtension;

class AppGameLogicExtension extends ConfigurableExtension
{
    public function loadInternal(array $config, ContainerBuilder $container): void
    {
        $this->loadServiceDefinitions($container);
    }

    private function loadServiceDefinitions(ContainerBuilder $container): void
    {
        $ymlFolder = __DIR__ . '/../../config/services';
        $loader = new YamlFileLoader($container, new FileLocator($ymlFolder));

        /** @var File $file */
        foreach ((new Finder())->files()->in($ymlFolder) as $file)
        {
            $loader->load($file->getFilename());
        }
    }
}
