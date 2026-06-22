<?php

declare(strict_types=1);

namespace App\GameCoreBundle\DataFixtures;

use App\GameCoreBundle\Economy\Material\Seeding\MaterialCatalogSeeder;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Seeds the material catalog (materials + production recipes). Delegates to the
 * {@see MaterialCatalogSeeder} so the catalog definition lives in a single,
 * reusable place that `make fixtures` drives.
 */
class Load0100_MaterialCatalog extends Fixture implements OrderedFixtureInterface
{
    public function __construct(
        private readonly MaterialCatalogSeeder $materialCatalogSeeder,
    ) {
    }

    public function load(ObjectManager $manager): void
    {
        $this->materialCatalogSeeder->seed();
    }

    public function getOrder(): int
    {
        return 100;
    }
}

