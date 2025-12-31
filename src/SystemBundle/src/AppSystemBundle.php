<?php

declare(strict_types=1);

namespace App\SystemBundle;

use Symfony\Component\HttpKernel\Bundle\Bundle;

class AppSystemBundle extends Bundle
{
    public function getPath(): string
    {
        return __DIR__;
    }
}
