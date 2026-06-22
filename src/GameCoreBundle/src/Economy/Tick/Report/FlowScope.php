<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\Report;

enum FlowScope: string
{
    case InterObject = 'inter-object';
    case InterSystem = 'inter-system';
}

