<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Entity;

use App\GameCoreBundle\World\Repository\WorldRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Aggregate root of the economy. Maps to the top of the GameFlow model:
 * a World owns Systems (S), which own CelestialBodies (objects O).
 */
#[Exclude]
#[ORM\Entity(repositoryClass: WorldRepository::class)]
#[ORM\Table(name: 'world')]
class World
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 100, unique: true)]
    private string $identifier;

    /** Number of economy ticks this world has been advanced by. */
    #[ORM\Column]
    private int $tick = 0;

    /** @var Collection<int, System> */
    #[ORM\OneToMany(targetEntity: System::class, mappedBy: 'world', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $systems;

    public function __construct(string $identifier)
    {
        $this->identifier = $identifier;
        $this->systems = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function getTick(): int
    {
        return $this->tick;
    }

    public function setTick(int $tick): static
    {
        $this->tick = $tick;

        return $this;
    }

    /**
     * @return Collection<int, System>
     */
    public function getSystems(): Collection
    {
        return $this->systems;
    }

    public function addSystem(System $system): static
    {
        if (!$this->systems->contains($system))
        {
            $this->systems->add($system);
            $system->setWorld($this);
        }

        return $this;
    }
}



