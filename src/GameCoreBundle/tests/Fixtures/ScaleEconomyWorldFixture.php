<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Tests\Fixtures;

use App\GameCoreBundle\Player\Entity\Player;
use App\SystemBundle\User\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\Uid\Uuid;

/**
 * Seeds a large, uniform economy world (systemCount x bodiesPerSystem x 3
 * resources) entirely via bulk DBAL inserts, with every body owned by a single
 * player. It exists to exercise the streaming tick at scale in the functional
 * test without the cost of hydrating tens of thousands of managed entities.
 *
 * Runs after {@see \App\GameCoreBundle\DataFixtures\Load0100_MaterialCatalog}
 * (order 100) so the material catalog it references is already present.
 */
final class ScaleEconomyWorldFixture extends Fixture implements OrderedFixtureInterface
{
    public const string WORLD_IDENTIFIER = 'scale_test';

    /** @var string[] */
    private const array MATERIALS = ['iron', 'water', 'regolith'];

    public function __construct(
        private readonly int $systemCount = 40,
        private readonly int $bodiesPerSystem = 30,
    ) {
    }

    public int $resourceCount {
        get => $this->systemCount * $this->bodiesPerSystem * count(self::MATERIALS);
    }

    public int $ownedBodyCount {
        get => $this->systemCount * $this->bodiesPerSystem;
    }

    public function load(ObjectManager $manager): void
    {
        $playerId = $this->createOwner($manager);
        $connection = $manager->getConnection();

        $materialIds = [];

        foreach (self::MATERIALS as $identifier)
        {
            $materialIds[] = (int) $connection->fetchOne('SELECT id FROM material WHERE identifier = ?', [$identifier]);
        }

        $connection->insert('world', ['identifier' => self::WORLD_IDENTIFIER, 'tick' => 0]);
        $worldId = (int) $connection->lastInsertId();

        $this->insertSystems($connection, $worldId);
        $this->insertBodies($connection, $worldId, $playerId);
        $this->insertResources($connection, $worldId, $materialIds);
    }

    public function getOrder(): int
    {
        return 300;
    }

    private function createOwner(ObjectManager $manager): int
    {
        $user = (new User())
            ->setUuid(Uuid::v4()->toRfc4122())
            ->setUsername('scale-owner')
            ->setPassword(password_hash('scale', PASSWORD_BCRYPT));
        $manager->persist($user);

        $player = (new Player())
            ->setUuid(Uuid::v4()->toRfc4122())
            ->setName('scale-owner')
            ->setUser($user);
        $manager->persist($player);

        $manager->flush();

        return (int) $player->getId();
    }

    private function insertSystems(Connection $connection, int $worldId): void
    {
        $connection->executeStatement(
            'INSERT INTO `system` (identifier, world_id)
             SELECT CONCAT(?, n), ?
             FROM (WITH RECURSIVE seq AS (SELECT 1 n UNION ALL SELECT n + 1 FROM seq WHERE n < ?) SELECT n FROM seq) t',
            ['scale_s_', $worldId, $this->systemCount],
        );
    }

    private function insertBodies(Connection $connection, int $worldId, int $playerId): void
    {
        $connection->executeStatement(
            'INSERT INTO celestial_body (identifier, x, y, system_id, player_id)
             SELECT CONCAT(s.identifier, ?, b.n), 0, 0, s.id, ?
             FROM `system` s
             CROSS JOIN (WITH RECURSIVE seq AS (SELECT 1 n UNION ALL SELECT n + 1 FROM seq WHERE n < ?) SELECT n FROM seq) b
             WHERE s.world_id = ?',
            ['_b_', $playerId, $this->bodiesPerSystem, $worldId],
        );
    }

    /**
     * @param int[] $materialIds
     */
    private function insertResources(Connection $connection, int $worldId, array $materialIds): void
    {
        $connection->executeStatement(
            'INSERT INTO celestial_body_resource
                 (reserves, regen_rate, extract_rate, storage_capacity, stock, demand, celestial_body_id, material_id)
             SELECT 1000, 5, 10, 500, 100, 60, b.id, m.material_id
             FROM celestial_body b
             INNER JOIN `system` s ON s.id = b.system_id
             CROSS JOIN (SELECT ? material_id UNION ALL SELECT ? UNION ALL SELECT ?) m
             WHERE s.world_id = ?',
            [$materialIds[0], $materialIds[1], $materialIds[2], $worldId],
        );
    }
}
