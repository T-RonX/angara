<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material\Type;

enum MaterialType: string
{
    case Raw = 'raw';
    case Refined = 'refined';
    case Component = 'component';
}
