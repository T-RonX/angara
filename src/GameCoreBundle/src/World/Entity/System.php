<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Entity;

use App\GameCoreBundle\World\Repository\SystemRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A System (S) in the GameFlow model. Groups CelestialBodies (objects O) and is
 * the level at which local supply/demand are aggregated into a local price.
 */
#[Exclude]
#[ORM\Entity(repositoryClass: SystemRepository::class)]
// `system` is a reserved word in MySQL, so the table name is escaped with backticks.
#[ORM\Table(name: '`system`')]
class System
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    private string $identifier;

    #[ORM\ManyToOne(targetEntity: World::class, inversedBy: 'systems')]
    #[ORM\JoinColumn(name: 'world_id', referencedColumnName: 'id', nullable: false)]
    private World $world;

    /** @var Collection<int, CelestialBody> */
    #[ORM\OneToMany(targetEntity: CelestialBody::class, mappedBy: 'system', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $celestialBodies;

    public function __construct(string $identifier)
    {
        $this->identifier = $identifier;
        $this->celestialBodies = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function getWorld(): World
    {
        return $this->world;
    }

    public function setWorld(World $world): static
    {
        $this->world = $world;

        return $this;
    }

    /**
     * @return Collection<int, CelestialBody>
     */
    public function getCelestialBodies(): Collection
    {
        return $this->celestialBodies;
    }

    public function addCelestialBody(CelestialBody $celestialBody): static
    {
        if (!$this->celestialBodies->contains($celestialBody))
        {
            $this->celestialBodies->add($celestialBody);
            $celestialBody->setSystem($this);
        }

        return $this;
    }
}

