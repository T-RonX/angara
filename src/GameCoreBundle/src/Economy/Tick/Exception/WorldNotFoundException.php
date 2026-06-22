<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Exception;

use RuntimeException;

class WorldNotFoundException extends RuntimeException
{
    public static function withIdentifier(string $identifier): self
    {
        return new self(sprintf('No world found with identifier "%s".', $identifier));
    }
}

