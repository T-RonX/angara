<?php

declare(strict_types=1);

namespace App\System\DataFixtures;

use ReflectionClass;
use RuntimeException;

trait OrderedFixtureTrait
{
    public function getOrder(): int
    {
        return preg_match(
            '#^Load(\d+)_\w+#',
            (new ReflectionClass($this))->getShortName(),
            $matches,
        )
            ? (int) $matches[1]
            : throw new RuntimeException('Unable to parse fixture order from filename');
    }
}
