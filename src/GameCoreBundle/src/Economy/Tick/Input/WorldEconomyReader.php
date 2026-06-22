<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Input;

use Doctrine\DBAL\Connection;

/**
 * Reads the per-tick economy input for a world set-based, bypassing the Doctrine
 * ORM. Hydrating the world graph lazy-loads each body's resource collection one
 * query at a time (an N+1 explosion at hundreds of bodies); instead the resources
 * are streamed one system at a time, so the calculation gets everything it needs
 * without ever holding the whole world in memory.
 */
final class WorldEconomyReader
{
    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    public function findWorld(string $identifier): ?WorldHeader
    {
        $row = $this->connection->fetchAssociative(
            'SELECT id, tick FROM world WHERE identifier = ?',
            [$identifier],
        );

        if ($row === false)
        {
            return null;
        }

        return new WorldHeader((int) $row['id'], (int) $row['tick']);
    }

    /**
     * Streams the world's resources system by system, in (system, body, resource)
     * order. Each system is read with its own small buffered query that is freed
     * before the next system is read, so peak memory stays bounded by the largest
     * single system rather than the whole world — yet the stream is still globally
     * system-contiguous, which is what the inter-object flow stage relies on.
     *
     * @return iterable<ResourceTickRow>
     */
    public function streamResourceRows(int $worldId): iterable
    {
        $sql = <<<'SQL'
            SELECT
                r.id AS resource_id,
                s.identifier AS system_identifier,
                b.identifier AS body_identifier,
                m.identifier AS material_identifier,
                r.reserves AS reserves,
                r.regen_rate AS regen_rate,
                r.extract_rate AS extract_rate,
                r.storage_capacity AS storage_capacity,
                r.stock AS stock,
                r.demand AS demand
            FROM celestial_body_resource r
            INNER JOIN celestial_body b ON b.id = r.celestial_body_id
            INNER JOIN `system` s ON s.id = b.system_id
            INNER JOIN material m ON m.id = r.material_id
            WHERE b.system_id = ?
            ORDER BY b.id, r.id
            SQL;

        $systemIds = $this->connection->fetchFirstColumn(
            'SELECT id FROM `system` WHERE world_id = ? ORDER BY id',
            [$worldId],
        );

        foreach ($systemIds as $systemId)
        {
            foreach ($this->connection->iterateAssociative($sql, [(int) $systemId]) as $row)
            {
                yield new ResourceTickRow(
                    (int) $row['resource_id'],
                    (string) $row['system_identifier'],
                    (string) $row['body_identifier'],
                    (string) $row['material_identifier'],
                    (float) $row['reserves'],
                    (float) $row['regen_rate'],
                    (float) $row['extract_rate'],
                    (float) $row['storage_capacity'],
                    (float) $row['stock'],
                    (float) $row['demand'],
                );
            }
        }
    }
}
