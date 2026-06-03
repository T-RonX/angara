<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material\Type;

enum RawMaterialType: string
{
    case Deposit = 'deposit';
    case Flow = 'flow';
}
