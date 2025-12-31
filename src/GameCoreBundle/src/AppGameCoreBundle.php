<?php

declare(strict_types=1);

namespace App\GameCoreBundle;

use Symfony\Component\HttpKernel\Bundle\Bundle;

class AppGameCoreBundle extends Bundle
{
    public function getPath(): string
    {
        return __DIR__;
    }
}
