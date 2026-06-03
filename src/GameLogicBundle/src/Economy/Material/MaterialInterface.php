<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

use App\GameLogicBundle\Economy\Material\Type\MaterialType;

interface MaterialInterface
{
    public string $identifier { get; }
    public MaterialType $type { get; }
}
