<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Tests\Functional\Economy;

use App\GameCoreBundle\DataFixtures\Load0100_MaterialCatalog;
use App\GameCoreBundle\DataFixtures\Load0200_DemoWorld;
use App\GameCoreBundle\Economy\Tick\EconomyTicker;
use App\GameCoreBundle\Tests\Fixtures\ScaleEconomyWorldFixture;
use Doctrine\Common\DataFixtures\Executor\ORMExecutor;
use Doctrine\Common\DataFixtures\Loader;
use Doctrine\Common\DataFixtures\Purger\ORMPurger;
use Doctrine\Common\DataFixtures\ReferenceRepository;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\TestDox;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * End-to-end coverage of the streaming, two-pass economy tick: that it reproduces
 * the GameFlow baseline exactly, that it stays memory-bounded and the read model
 * stays row-bounded at scale, and that body ownership survives a tick.
 *
 * The two scenarios use dedicated fixtures: the hand-tuned demo world for the
 * deterministic maths, and {@see ScaleEconomyWorldFixture} for the scale/perf run.
 */
final class EconomyTickTest extends KernelTestCase
{
    private const int SCALE_MEMORY_CAP_BYTES = 256 * 1024 * 1024;

    private const float SCALE_TIME_BUDGET_SECONDS = 60.0;

    private ?EntityManagerInterface $entityManager = null;

    private ?Connection $connection = null;

    private ?EconomyTicker $economyTicker = null;

    protected function setUp(): void
    {
        self::bootKernel();

        $container = self::getContainer();
        $this->entityManager = $container->get(EntityManagerInterface::class);
        $this->connection = $this->entityManager->getConnection();
        $this->economyTicker = $container->get(EconomyTicker::class);
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        $this->entityManager = null;
        $this->connection = null;
        $this->economyTicker = null;
    }

    #[Test, TestDox('Three ticks of the demo world reproduce the GameFlow baseline exactly')]
    public function tickReproducesBaseline(): void
    {
        // Arrange
        $this->loadFixtures([
            self::getContainer()->get(Load0100_MaterialCatalog::class),
            self::getContainer()->get(Load0200_DemoWorld::class),
        ]);

        // Act
        for ($i = 0; $i < 3; $i++)
        {
            $this->economyTicker->tick(Load0200_DemoWorld::WORLD_IDENTIFIER);
        }

        // Assert
        self::assertSame(1140.0, $this->ironReserves('s1o1'));

        $pressure = $this->ironGlobalPressure();
        self::assertSame(160.0, (float) $pressure['total_supply']);
        self::assertSame(140.0, (float) $pressure['total_demand']);
        self::assertSame(0.0, (float) $pressure['introduce']);
        self::assertSame(34.0, (float) $pressure['expire']);
    }

    #[Test, TestDox('At scale the tick keeps no per-body detail in memory and the read model stays row-bounded')]
    public function tickIsStreamingAndBoundedAtScale(): void
    {
        // Arrange
        $scale = new ScaleEconomyWorldFixture();
        $this->loadFixtures([
            self::getContainer()->get(Load0100_MaterialCatalog::class),
            $scale,
        ]);

        $start = microtime(true);

        // Act
        $report = $this->economyTicker->tick(ScaleEconomyWorldFixture::WORLD_IDENTIFIER);

        // Assert — the report holds only the small bounded aggregates: the O(bodies)
        // detail is streamed straight to the writer, never retained. This is the
        // core guarantee that replaced the old in-memory TickReport.
        self::assertSame([], $report->bodyStates);
        self::assertSame([], $report->flows);
        self::assertNotSame([], $report->pressures);

        // The current-state read model holds exactly one row per input resource...
        self::assertSame($scale->resourceCount, $this->bodyStateRowCount());

        // ...and a second tick overwrites rather than appends.
        $this->economyTicker->tick(ScaleEconomyWorldFixture::WORLD_IDENTIFIER);
        self::assertSame($scale->resourceCount, $this->bodyStateRowCount());

        $elapsed = microtime(true) - $start;
        self::assertLessThan(self::SCALE_TIME_BUDGET_SECONDS, $elapsed);
        self::assertLessThan(self::SCALE_MEMORY_CAP_BYTES, memory_get_peak_usage(true));
    }

    #[Test, TestDox('Collecting detail repopulates the report so the renderer still works')]
    public function tickCollectsDetailWhenRequested(): void
    {
        // Arrange
        $this->loadFixtures([
            self::getContainer()->get(Load0100_MaterialCatalog::class),
            self::getContainer()->get(Load0200_DemoWorld::class),
        ]);

        // Act
        $report = $this->economyTicker->tick(Load0200_DemoWorld::WORLD_IDENTIFIER, collectDetail: true);

        // Assert
        self::assertNotSame([], $report->bodyStates);
        self::assertNotSame([], $report->flows);
    }

    #[Test, TestDox('A player owns the bodies seeded for it')]
    public function playerOwnsItsBodies(): void
    {
        // Arrange
        $scale = new ScaleEconomyWorldFixture(systemCount: 2, bodiesPerSystem: 3);
        $this->loadFixtures([
            self::getContainer()->get(Load0100_MaterialCatalog::class),
            $scale,
        ]);

        // Act
        $ownedBodies = (int) $this->connection->fetchOne(
            'SELECT COUNT(*) FROM celestial_body b INNER JOIN player p ON p.id = b.player_id WHERE p.name = ?',
            ['scale-owner'],
        );

        // Assert
        self::assertSame($scale->ownedBodyCount, $ownedBodies);
    }

    /**
     * @param object[] $fixtures
     */
    private function loadFixtures(array $fixtures): void
    {
        $loader = new Loader();

        foreach ($fixtures as $fixture)
        {
            $loader->addFixture($fixture);
        }

        $executor = new ORMExecutor($this->entityManager, new ORMPurger($this->entityManager));
        $executor->setReferenceRepository(new ReferenceRepository($this->entityManager));
        $executor->execute($loader->getFixtures());
    }

    private function ironReserves(string $bodyIdentifier): float
    {
        return (float) $this->connection->fetchOne(
            'SELECT r.reserves
             FROM celestial_body_resource r
             INNER JOIN celestial_body b ON b.id = r.celestial_body_id
             INNER JOIN material m ON m.id = r.material_id
             WHERE b.identifier = ? AND m.identifier = ?',
            [$bodyIdentifier, 'iron'],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function ironGlobalPressure(): array
    {
        return $this->connection->fetchAssociative(
            'SELECT total_supply, total_demand, introduce, expire
             FROM current_global_resource_pressure
             WHERE material_identifier = ?',
            ['iron'],
        );
    }

    private function bodyStateRowCount(): int
    {
        return (int) $this->connection->fetchOne('SELECT COUNT(*) FROM current_body_resource_state');
    }
}
