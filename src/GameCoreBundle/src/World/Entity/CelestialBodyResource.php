<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Entity;

use App\GameCoreBundle\Economy\Material\Entity\Material;
use App\GameCoreBundle\World\Repository\CelestialBodyResourceRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * The persistent, evolving economic state of a single resource (Material) on a
 * single CelestialBody (object O).
 *
 * It holds the inputs the GameFlow model needs:
 *  - Layer 0 (physical): {@see $reserves}, {@see $regenRate}, {@see $extractRate}
 *  - Layer 1 (production): {@see $storageCapacity}, {@see $stock}, {@see $demand}
 *
 * The static resource properties (type, base price, scarcity sensitivity, decay,
 * desired scarcity index) live on the referenced {@see Material}, not here, so
 * they have a single source of truth.
 */
#[Exclude]
#[ORM\Entity(repositoryClass: CelestialBodyResourceRepository::class)]
#[ORM\Table(name: 'celestial_body_resource')]
class CelestialBodyResource
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CelestialBody::class, inversedBy: 'resources')]
    #[ORM\JoinColumn(name: 'celestial_body_id', referencedColumnName: 'id', nullable: false)]
    private CelestialBody $celestialBody;

    #[ORM\ManyToOne(targetEntity: Material::class)]
    #[ORM\JoinColumn(name: 'material_id', referencedColumnName: 'id', nullable: false)]
    private Material $material;

    #[ORM\Column]
    private float $reserves = 0.0;

    #[ORM\Column]
    private float $regenRate = 0.0;

    #[ORM\Column]
    private float $extractRate = 0.0;

    #[ORM\Column]
    private float $storageCapacity = 0.0;

    #[ORM\Column]
    private float $stock = 0.0;

    #[ORM\Column]
    private float $demand = 0.0;

    public function __construct(Material $material)
    {
        $this->material = $material;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCelestialBody(): CelestialBody
    {
        return $this->celestialBody;
    }

    public function setCelestialBody(CelestialBody $celestialBody): static
    {
        $this->celestialBody = $celestialBody;

        return $this;
    }

    public function getMaterial(): Material
    {
        return $this->material;
    }

    public function getMaterialIdentifier(): string
    {
        return $this->material->getIdentifier();
    }

    public function getReserves(): float
    {
        return $this->reserves;
    }

    public function setReserves(float $reserves): static
    {
        $this->reserves = $reserves;

        return $this;
    }

    public function getRegenRate(): float
    {
        return $this->regenRate;
    }

    public function setRegenRate(float $regenRate): static
    {
        $this->regenRate = $regenRate;

        return $this;
    }

    public function getExtractRate(): float
    {
        return $this->extractRate;
    }

    public function setExtractRate(float $extractRate): static
    {
        $this->extractRate = $extractRate;

        return $this;
    }

    public function getStorageCapacity(): float
    {
        return $this->storageCapacity;
    }

    public function setStorageCapacity(float $storageCapacity): static
    {
        $this->storageCapacity = $storageCapacity;

        return $this;
    }

    public function getStock(): float
    {
        return $this->stock;
    }

    public function setStock(float $stock): static
    {
        $this->stock = $stock;

        return $this;
    }

    public function getDemand(): float
    {
        return $this->demand;
    }

    public function setDemand(float $demand): static
    {
        $this->demand = $demand;

        return $this;
    }
}

