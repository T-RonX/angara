<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain;

use SplQueue;

class TerrainRegionDetector
{
    private array $map;
    private int $rows;
    private int $cols;
    private array $visited;

    public function detect(array $map): array
    {
        $this->map = $map;
        $this->rows = count($map);
        $this->cols = count($map[0]);
        $this->visited = array_fill(0, $this->rows, array_fill(0, $this->cols, false));

        $regions = [];

        for ($i = 0; $i < $this->rows; $i++)
        {
            for ($j = 0; $j < $this->cols; $j++)
            {
                if (!$this->visited[$i][$j])
                {
                    $regionType = $this->map[$i][$j]->getProperties()->getId();
                    $region = $this->floodFill($i, $j, $regionType);

                    if (!isset($regions[$regionType]))
                    {
                        $regions[$regionType] = [];
                    }

                    $regions[$regionType][] = $region;
                }
            }
        }

        foreach ($regions as &$region)
        {
            usort($region, static fn($a, $b): int => count($b) <=> count($a));
        }

        return $regions;
    }

    private function floodFill(int $i, int $j, $type): array
    {
        $region = [];
        $queue = new SplQueue();
        $queue->enqueue([$i, $j]);
        $directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

        while (!$queue->isEmpty())
        {
            [$x, $y] = $queue->dequeue();

            if ($x < 0 || $x >= $this->rows || $y < 0 || $y >= $this->cols || $this->visited[$x][$y] || $this->map[$x][$y]->getProperties()->getId() !== $type)
            {
                continue;
            }

            $this->visited[$x][$y] = true;
            $region[] = [$x, $y];

            foreach ($directions as $direction)
            {
                $queue->enqueue([$x + $direction[0], $y + $direction[1]]);
            }
        }

        return $region;
    }
}
