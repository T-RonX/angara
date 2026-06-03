<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

use GameLogicBundle\Economy\Materials\Exception\MaterialAlreadyRegisteredException;

class MaterialCollection
{
    /** @var array{string: MaterialInterface}  */
    public private(set) array $materials = [];
    public private(set) array $materialsTypes = [];

    public function add(MaterialInterface $material): static
    {
        if (array_key_exists($material->identifier, $this->materials))
        {
            throw new MaterialAlreadyRegisteredException(sprintf('Material with identifier "%s" already registered.', $material->identifier));
        }

        $this->materials[$material->identifier] = $material;
        $this->materialsTypes[$material->type->value][$material->identifier] = $material;

        return $this;
    }

    public function has(string $identifier): bool
    {
        return array_key_exists($identifier, $this->materials);
    }

    public function hasAll(array $identifiers): bool
    {
        return array_all($identifiers, $this->has(...));
    }
}
