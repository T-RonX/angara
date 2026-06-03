<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

class MaterialProcess
{
    public function __construct(
        readonly public private(set) MaterialInputs $inputs,
        readonly public private(set) MaterialOutputs $yields,
    ) {
    }

    /**
     * @return string[]
     */
    public function getInputIdentifiers(): array
    {
        return array_map(
            static fn (MaterialInput $r): string => $r->materialIdentifier,
            $this->inputs->inputs,
        );
    }

    /**
     * @return string[]
     */
    public function getYieldIdentifiers(): array
    {
        return array_map(
            static fn (MaterialOutput $y): string => $y->materialIdentifier,
            $this->yields->outputs,
        );
    }

    /**
     * @return string[]
     */
    public function getAllIdentifiers(): array
    {
        return [
            ...$this->getInputIdentifiers(),
            ...$this->getYieldIdentifiers(),
        ]
            |> array_unique(...)
            |> array_values(...);
    }
}
