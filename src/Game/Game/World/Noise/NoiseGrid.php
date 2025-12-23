<?php

declare(strict_types=1);

namespace App\Game\Game\World\Noise;

use SplFixedArray;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class NoiseGrid
{
    /**
     * @param SplFixedArray<SplFixedArray<float>> $grid
     */
    public function __construct(
        public SplFixedArray $grid,
    ) {
    }

    /**
     * Normalize noise grid to values between 0 and 1 and returns a new instance.
     *
     * @return static
     */
    public function normalize(): static
    {
        $newGrid = $this->clone();

        $min = PHP_FLOAT_MAX;
        $max = -PHP_FLOAT_MAX;

        foreach ($newGrid->grid as $row)
        {
            foreach ($row as $value)
            {
                if ($value < $min)
                {
                    $min = $value;
                }

                if ($value > $max)
                {
                    $max = $value;
                }
            }
        }

        $range = $max - $min;

        foreach ($newGrid->grid as $x => $row)
        {
            foreach ($row as $y => $value)
            {
                $newGrid->grid[$x][$y] = ($value - $min) / $range;
            }
        }

        return $newGrid;
    }

    public function clone(): static
    {
        $height = $this->grid->count();
        $clone = new SplFixedArray($height);

        for ($x = 0; $x < $height; ++$x)
        {
            $row = $this->grid[$x];
            $width = $row->count();

            $newRow = new SplFixedArray($width);

            for ($y = 0; $y < $width; $y++)
            {
                $newRow[$y] = $row[$y];
            }

            $clone[$x] = $newRow;
        }

        return new static($clone);
    }
}
