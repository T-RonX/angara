<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

class MaterialOutputs
{
    /**
     * @param MaterialOutput[] $outputs
     */
    public function __construct(
        readonly public private(set) array $outputs = [],
    ) {
    }
}

