<?php

declare(strict_types=1);

namespace App\Game\Environment\Generator\Planet\Terrain;

use App\Game\Environment\Generator\Planet\Terrain\Type\TerrainType;
use RuntimeException;

class TerrainDescriptor
{
    /**
     * @param TerrainType[] $types
     */
    public function __construct(
        private array $types,
    ) {
        foreach ($this->types as $id => $type)
        {
            $type->setId($id);
        }
    }

    public function getTypes(): array
    {
        return $this->types;
    }

    public function setTypes(array $types): self
    {
        $this->types = $types;

        return $this;
    }

    public function getTerrain(float $value): TerrainType
    {
        foreach ($this->types as $type)
        {
            if (
                $type->getStart() <= $value
                && $type->getEnd() > $value
            ) {
                return $type;
            }
        }

        throw new RuntimeException(sprintf('No terrain type for value %s specified', $value));
    }
}
