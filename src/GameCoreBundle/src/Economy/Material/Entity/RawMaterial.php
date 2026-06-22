<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Contract\ResourceInterface;
use App\GameCoreBundle\Economy\Material\Type\MaterialType;
use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A raw resource (the GameFlow "R"): extracted or harvested from a celestial body.
 * On top of its market pricing it has a {@see RawMaterialType} (deposit or flow).
 */
#[Exclude]
#[ORM\Entity]
class RawMaterial extends MarketMaterial implements ResourceInterface
{
    #[ORM\Column(enumType: RawMaterialType::class, nullable: true)]
    private RawMaterialType $rawType = RawMaterialType::Deposit;

    public function getType(): MaterialType
    {
        return MaterialType::Raw;
    }

    public function getRawType(): RawMaterialType
    {
        return $this->rawType;
    }

    public function setRawType(RawMaterialType $rawType): static
    {
        $this->rawType = $rawType;

        return $this;
    }
}

