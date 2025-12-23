<?php

declare(strict_types=1);

namespace App\Game\Game\SpatialEntity;

use App\Game\Game\SpatialEntity\Builder\CelestialBody\CelestialBodyBuilder;
use App\Game\Game\SpatialEntity\Entity\CelestialBody\CelestialBody;
use Symfony\Component\DependencyInjection\Attribute\AutowireLocator;
use Symfony\Component\DependencyInjection\ServiceLocator;

class SpacialEntityBuilder
{
    public function __construct(
        #[AutowireLocator([
            CelestialBody::class => CelestialBodyBuilder::class,
        ])]
        private readonly ServiceLocator $builderLocator,
    ) {

    }

    public function buildCelestialBody(int $size, string|null $seed): CelestialBodyBuilder
    {
        /** @var CelestialBodyBuilder $builder */
        $builder = $this->builderLocator->get(CelestialBody::class);

        return $builder
            ->setSeed($seed)
            ->setSize($size);
    }
}
