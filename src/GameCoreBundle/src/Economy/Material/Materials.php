<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

/**
 * Read-only facade over the loaded material catalog and its processes.
 */
class Materials
{
    /** @var array<string, MaterialInterface> */
    public array $all { get => $this->materialsLoader->getMaterials()->materials; }

    /** @var array<string, MaterialProcess[]> */
    public array $processesByInput { get => $this->materialsLoader->getProcesses()->processesByInput; }

    /** @var array<string, MaterialProcess[]> */
    public array $processesByOutput { get => $this->materialsLoader->getProcesses()->processesByOutput; }

    public function __construct(
        readonly private MaterialsLoader $materialsLoader,
    ) {
    }

    public function get(string $identifier): ?MaterialInterface
    {
        return $this->materialsLoader->getMaterials()->get($identifier);
    }

    public function has(string $identifier): bool
    {
        return $this->materialsLoader->getMaterials()->has($identifier);
    }
}

