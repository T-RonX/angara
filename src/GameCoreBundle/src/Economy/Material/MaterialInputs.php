<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

class MaterialInputs
{
    /**
     * @param MaterialInput[] $inputs
     */
    public function __construct(
        readonly public private(set) array $inputs = [],
    ) {
    }
}

