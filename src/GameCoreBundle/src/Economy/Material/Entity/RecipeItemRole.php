<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

enum RecipeItemRole: string
{
    case Input = 'input';
    case Output = 'output';
}

