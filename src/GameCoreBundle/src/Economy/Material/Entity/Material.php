<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Material\MaterialInterface;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRepository;
use App\GameCoreBundle\Economy\Material\Type\MaterialType;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Persistent definition of a material and the root of the material inheritance
 * hierarchy (single-table inheritance). Every material has an identifier and a
 * storage decay rate; the more specific properties live on the subtypes:
 *
 *  - {@see RawMaterial}       — a raw resource (ResourceInterface)
 *  - {@see RefinedMaterial}   — a refined compound (CompoundInterface)
 *  - {@see ComponentMaterial} — a component compound (CompoundInterface)
 */
#[Exclude]
#[ORM\Entity(repositoryClass: MaterialRepository::class)]
#[ORM\Table(name: 'material')]
#[ORM\InheritanceType('SINGLE_TABLE')]
#[ORM\DiscriminatorColumn(name: 'type', type: 'string', length: 20)]
#[ORM\DiscriminatorMap([
    'raw' => RawMaterial::class,
    'refined' => RefinedMaterial::class,
    'component' => ComponentMaterial::class,
])]
abstract class Material implements MaterialInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 100, unique: true)]
    private string $identifier;

    #[ORM\Column]
    private float $storageDecayRate = 0.0;

    public function __construct(string $identifier)
    {
        $this->identifier = $identifier;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    abstract public function getType(): MaterialType;

    public function getStorageDecayRate(): float
    {
        return $this->storageDecayRate;
    }

    public function setStorageDecayRate(float $storageDecayRate): static
    {
        $this->storageDecayRate = $storageDecayRate;

        return $this;
    }
}

