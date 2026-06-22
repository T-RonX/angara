<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Contract;

use App\GameCoreBundle\Economy\Material\MaterialInterface;

/**
 * A compound (produced) material: refined goods and components. It is crafted from
 * other materials through a recipe rather than extracted.
 */
interface CompoundInterface extends MaterialInterface
{
}

