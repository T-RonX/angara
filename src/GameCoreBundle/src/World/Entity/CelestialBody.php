<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Entity;

use App\GameCoreBundle\World\Repository\CelestialBodyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A CelestialBody is an "object O" of the GameFlow model and, at the same time,
 * the persistent identity of a place on the map.
 *
 * The procedural terrain (biomes, borders, ...) is a derived artifact that the
 * spatial generator in the World\SpatialEntity namespace rebuilds
 * deterministically from {@see $presetName} and {@see $seed}, so it is never
 * persisted here. This is what unifies the (previously duplicated) economic and
 * spatial notions of a celestial body into a single source of truth.
 */
#[Exclude]
#[ORM\Entity(repositoryClass: CelestialBodyRepository::class)]
#[ORM\Table(name: 'celestial_body')]
class CelestialBody
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    private string $identifier;

    #[ORM\ManyToOne(targetEntity: System::class, inversedBy: 'celestialBodies')]
    #[ORM\JoinColumn(name: 'system_id', referencedColumnName: 'id', nullable: false)]
    private System $system;

    #[ORM\Column]
    private int $x = 0;

    #[ORM\Column]
    private int $y = 0;

    /** Spatial generation preset, see CelestialBodyBuilderPreset. */
    #[ORM\Column(length: 50, nullable: true)]
    private ?string $presetName = null;

    /** Deterministic spatial generation seed. */
    #[ORM\Column(length: 100, nullable: true)]
    private ?string $seed = null;

    /** @var Collection<int, CelestialBodyResource> */
    #[ORM\OneToMany(targetEntity: CelestialBodyResource::class, mappedBy: 'celestialBody', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $resources;

    public function __construct(string $identifier)
    {
        $this->identifier = $identifier;
        $this->resources = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function getSystem(): System
    {
        return $this->system;
    }

    public function setSystem(System $system): static
    {
        $this->system = $system;

        return $this;
    }

    public function getX(): int
    {
        return $this->x;
    }

    public function getY(): int
    {
        return $this->y;
    }

    public function setLocation(int $x, int $y): static
    {
        $this->x = $x;
        $this->y = $y;

        return $this;
    }

    public function getPresetName(): ?string
    {
        return $this->presetName;
    }

    public function setPresetName(?string $presetName): static
    {
        $this->presetName = $presetName;

        return $this;
    }

    public function getSeed(): ?string
    {
        return $this->seed;
    }

    public function setSeed(?string $seed): static
    {
        $this->seed = $seed;

        return $this;
    }

    /**
     * @return Collection<int, CelestialBodyResource>
     */
    public function getResources(): Collection
    {
        return $this->resources;
    }

    public function addResource(CelestialBodyResource $resource): static
    {
        if (!$this->resources->contains($resource))
        {
            $this->resources->add($resource);
            $resource->setCelestialBody($this);
        }

        return $this;
    }

    public function getResource(string $materialIdentifier): ?CelestialBodyResource
    {
        foreach ($this->resources as $resource)
        {
            if ($resource->getMaterialIdentifier() === $materialIdentifier)
            {
                return $resource;
            }
        }

        return null;
    }
}


