<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Material\PricedMaterialInterface;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A material that carries its own market pricing (the GameFlow "Resources
 * properties"): a desired scarcity index, a base price and a price/scarcity
 * sensitivity. Shared by raw resources and refined goods; components do not
 * extend it because their cost is derived from their recipe at runtime.
 */
#[Exclude]
#[ORM\Entity]
abstract class MarketMaterial extends Material implements PricedMaterialInterface
{
    #[ORM\Column]
    private float $desiredScarcityIndex = 0.0;

    #[ORM\Column]
    private float $basePrice = 1.0;

    #[ORM\Column]
    private float $priceScarcitySensitivity = 0.5;

    public function getDesiredScarcityIndex(): float
    {
        return $this->desiredScarcityIndex;
    }

    public function setDesiredScarcityIndex(float $desiredScarcityIndex): static
    {
        $this->desiredScarcityIndex = $desiredScarcityIndex;

        return $this;
    }

    public function getBasePrice(): float
    {
        return $this->basePrice;
    }

    public function setBasePrice(float $basePrice): static
    {
        $this->basePrice = $basePrice;

        return $this;
    }

    public function getPriceScarcitySensitivity(): float
    {
        return $this->priceScarcitySensitivity;
    }

    public function setPriceScarcitySensitivity(float $priceScarcitySensitivity): static
    {
        $this->priceScarcitySensitivity = $priceScarcitySensitivity;

        return $this;
    }
}

