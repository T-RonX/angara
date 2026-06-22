<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

class MaterialOutput
{
    public function __construct(
        readonly public private(set) string $materialIdentifier,
        readonly public private(set) int $quantity,
    ) {
    }
}

