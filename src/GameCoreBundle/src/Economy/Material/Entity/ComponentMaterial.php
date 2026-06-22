<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Contract\CompoundInterface;
use App\GameCoreBundle\Economy\Material\Type\MaterialType;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A component compound: assembled from other materials. Unlike the other types it
 * has no market pricing of its own — its value is the runtime sum of its recipe's
 * input costs — so it carries the fewest properties (just identifier + decay).
 */
#[Exclude]
#[ORM\Entity]
class ComponentMaterial extends Material implements CompoundInterface
{
    public function getType(): MaterialType
    {
        return MaterialType::Component;
    }
}

