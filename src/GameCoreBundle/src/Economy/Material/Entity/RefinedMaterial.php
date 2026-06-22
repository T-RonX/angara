<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Contract\CompoundInterface;
use App\GameCoreBundle\Economy\Material\Type\MaterialType;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A refined compound: produced from raw materials through a recipe, but still
 * market-priced in its own right (it extends {@see MarketMaterial}).
 */
#[Exclude]
#[ORM\Entity]
class RefinedMaterial extends MarketMaterial implements CompoundInterface
{
    public function getType(): MaterialType
    {
        return MaterialType::Refined;
    }
}

