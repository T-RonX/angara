<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

class Materials
{
    /** @var array{string: MaterialInterface}  */
    public array $all { get => $this->materialsLoader->materials->materials; }
    public array $processesByInput { get => $this->materialsLoader->processes->processesByInput; }
    public array $processesByOutput { get => $this->materialsLoader->processes->processesByOutput; }

    public function __construct(
        readonly private MaterialsLoader $materialsLoader,
    ) {
    }
}
