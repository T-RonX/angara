<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Evolution;

use Doctrine\DBAL\Connection;

/**
 * Writes the evolved per-resource state back to the database in bulk, bypassing
 * the Doctrine UnitOfWork. Changes are fed in one at a time via {@see add} and
 * flushed as multi-row {@code UPDATE ... CASE} statements once a batch fills, so
 * applying hundreds of thousands of resource updates per tick costs a handful of
 * statements instead of one managed entity (and change-set computation) per row —
 * and never materializes an O(resources) array.
 */
final class ResourceStateWriter
{
    private const int BATCH_SIZE = 500;

    /** @var ResourceStateChange[] */
    private array $batch = [];

    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    public function reset(): void
    {
        $this->batch = [];
    }

    public function add(ResourceStateChange $change): void
    {
        $this->batch[] = $change;

        if (count($this->batch) >= self::BATCH_SIZE)
        {
            $this->flushBatch();
        }
    }

    public function flush(): void
    {
        $this->flushBatch();
    }

    private function flushBatch(): void
    {
        if ($this->batch === [])
        {
            return;
        }

        $reservesCase = '';
        $stockCase = '';
        $ids = [];
        $params = [];

        foreach ($this->batch as $index => $change)
        {
            // Primary keys are integers read from the database, so inlining them
            // is injection-safe and avoids reusing a named placeholder (which
            // native prepared statements disallow); only the float values bind.
            $id = $change->resourceId;
            $reservesCase .= sprintf(' WHEN %d THEN :reserves%d', $id, $index);
            $stockCase .= sprintf(' WHEN %d THEN :stock%d', $id, $index);
            $ids[] = $id;
            $params['reserves' . $index] = $change->reserves;
            $params['stock' . $index] = $change->stock;
        }

        $sql = sprintf(
            'UPDATE celestial_body_resource SET reserves = CASE id%s END, stock = CASE id%s END WHERE id IN (%s)',
            $reservesCase,
            $stockCase,
            implode(', ', $ids),
        );

        $this->connection->executeStatement($sql, $params);

        $this->batch = [];
    }
}
