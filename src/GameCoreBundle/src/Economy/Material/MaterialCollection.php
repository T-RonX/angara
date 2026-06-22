<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

use App\GameCoreBundle\Economy\Material\Exception\MaterialAlreadyRegisteredException;

class MaterialCollection
{
    /** @var array<string, MaterialInterface> */
    public private(set) array $materials = [];

    /** @var array<string, array<string, MaterialInterface>> */
    public private(set) array $materialsTypes = [];

    public function add(MaterialInterface $material): static
    {
        if (array_key_exists($material->getIdentifier(), $this->materials))
        {
            throw new MaterialAlreadyRegisteredException(sprintf('Material with identifier "%s" already registered.', $material->getIdentifier()));
        }

        $this->materials[$material->getIdentifier()] = $material;
        $this->materialsTypes[$material->getType()->value][$material->getIdentifier()] = $material;

        return $this;
    }

    public function get(string $identifier): ?MaterialInterface
    {
        return $this->materials[$identifier] ?? null;
    }

    public function has(string $identifier): bool
    {
        return array_key_exists($identifier, $this->materials);
    }

    /**
     * @param string[] $identifiers
     */
    public function hasAll(array $identifiers): bool
    {
        return array_all($identifiers, $this->has(...));
    }
}

