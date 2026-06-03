<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

use GameLogicBundle\Economy\Materials\Exception\MaterialUnregisteredException;

class MaterialProcesses
{
    /** @var MaterialProcess[]  */
    public private(set) array $processes = [];

    /** @var array<string, MaterialProcess[]> */
    public private(set) array $processesByInput = [];

    /** @var array<string, MaterialProcess[]> */
    public private(set) array $processesByOutput = [];

    public function __construct(
        readonly private MaterialCollection $materialCollection,
    ) {
    }

    public function add(MaterialProcess $process): static
    {
        if (!$this->materialCollection->hasAll($process->getAllIdentifiers()))
        {
            throw new MaterialUnregisteredException(sprintf('One or more materials are not registered: %s.', implode(', ', array_map(static fn ($id): string => "'$id'", $process->getAllIdentifiers()))));
        }

        $this->processes[] = $process;

        foreach ($process->getInputIdentifiers() as $id)
        {
            $this->processesByInput[$id][] = $process;
        }

        foreach ($process->getYieldIdentifiers() as $id)
        {
            $this->processesByOutput[$id][] = $process;
        }

        return $this;
    }
}
