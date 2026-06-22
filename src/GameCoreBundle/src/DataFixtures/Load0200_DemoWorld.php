<?php

declare(strict_types=1);

namespace App\GameCoreBundle\DataFixtures;

use App\GameCoreBundle\Economy\Material\Entity\Material;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRepository;
use App\GameCoreBundle\World\Entity\CelestialBody;
use App\GameCoreBundle\World\Entity\CelestialBodyResource;
use App\GameCoreBundle\World\Entity\System;
use App\GameCoreBundle\World\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Seeds the demo economy world: two systems of two celestial bodies, with the
 * raw materials scattered across the bodies (each resource referencing a
 * {@see Material} from the catalog). Runs after the material catalog fixture.
 */
class Load0200_DemoWorld extends Fixture implements OrderedFixtureInterface
{
    public const string WORLD_IDENTIFIER = 'angara';

    /** @var array<string, Material> */
    private array $materialCache = [];

    public function __construct(
        private readonly MaterialRepository $materialRepository,
    ) {
    }

    public function load(ObjectManager $manager): void
    {
        $world = new World(self::WORLD_IDENTIFIER);

        foreach ($this->layout() as $systemIdentifier => $bodies)
        {
            $system = new System($systemIdentifier);
            $world->addSystem($system);

            foreach ($bodies as $body)
            {
                $celestialBody = (new CelestialBody($body['identifier']))
                    ->setLocation($body['x'], $body['y'])
                    ->setPresetName($body['preset']);
                $system->addCelestialBody($celestialBody);

                foreach ($body['resources'] as [$materialIdentifier, $reserves, $regenRate, $extractRate, $storageCapacity, $stock, $demand])
                {
                    $celestialBody->addResource(
                        (new CelestialBodyResource($this->material($materialIdentifier)))
                            ->setReserves($reserves)
                            ->setRegenRate($regenRate)
                            ->setExtractRate($extractRate)
                            ->setStorageCapacity($storageCapacity)
                            ->setStock($stock)
                            ->setDemand($demand),
                    );
                }
            }
        }

        $manager->persist($world);
        $manager->flush();
    }

    public function getOrder(): int
    {
        return 200;
    }

    private function material(string $identifier): Material
    {
        return $this->materialCache[$identifier] ??= $this->materialRepository->findOneBy(['identifier' => $identifier])
            ?? throw new RuntimeException(sprintf('Material "%s" is not seeded; run the material catalog fixture first.', $identifier));
    }

    /**
     * The whole demo layout. Each resource row is:
     * [materialIdentifier, reserves, regenRate, extractRate, storageCapacity, stock, demand].
     *
     * @return array<string, list<array{identifier: string, preset: string, x: int, y: int, resources: list<array{0: string, 1: float, 2: float, 3: float, 4: float, 5: float, 6: float}>}>>
     */
    private function layout(): array
    {
        return [
            's_1' => [
                [
                    'identifier' => 's1o1',
                    'preset' => 'style_1',
                    'x' => 1,
                    'y' => 1,
                    'resources' => [
                        //   material     reserves  regen  extract  capacity  stock  demand
                        ['iron',         1500.0,   0.0,   120.0,   600.0,    250.0, 60.0],
                        ['water',        800.0,    10.0,  40.0,    300.0,    120.0, 50.0],
                        ['regolith',     5000.0,   0.0,   200.0,   400.0,    100.0, 30.0],
                    ],
                ],
                [
                    'identifier' => 's1o2',
                    'preset' => 'style_2',
                    'x' => 2,
                    'y' => 1,
                    'resources' => [
                        ['wood',         0.0,      60.0,  50.0,    300.0,    140.0, 45.0],
                        ['aluminium',    1200.0,   0.0,   30.0,    250.0,    80.0,  40.0],
                        ['lithium',      400.0,    0.0,   8.0,     100.0,    20.0,  15.0],
                    ],
                ],
            ],
            's_2' => [
                [
                    'identifier' => 's2o1',
                    'preset' => 'style_3',
                    'x' => 1,
                    'y' => 2,
                    'resources' => [
                        ['lithium',      900.0,    0.0,   20.0,    150.0,    60.0,  25.0],
                        ['regolith',     8000.0,   0.0,   150.0,   500.0,    300.0, 40.0],
                        ['water',        1500.0,   20.0,  30.0,    400.0,    200.0, 35.0],
                    ],
                ],
                [
                    'identifier' => 's2o2',
                    'preset' => 'style_4',
                    'x' => 2,
                    'y' => 2,
                    'resources' => [
                        ['iron',         700.0,    0.0,   40.0,    800.0,    500.0, 80.0],
                        ['wood',         3000.0,   40.0,  200.0,   450.0,    60.0,  30.0],
                        ['aluminium',    600.0,    0.0,   25.0,    300.0,    150.0, 20.0],
                    ],
                ],
            ],
        ];
    }
}

