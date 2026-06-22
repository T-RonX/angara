<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Player\Entity;

use App\GameCoreBundle\Player\Repository\PlayerRepository;
use App\GameCoreBundle\World\Entity\CelestialBody;
use App\SystemBundle\Doctrine\Uuid\Entity\EntityUuidInterface;
use App\SystemBundle\Doctrine\Uuid\Entity\EntityUuidTrait;
use App\SystemBundle\User\Entity\User;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
#[ORM\Entity(repositoryClass: PlayerRepository::class)]
#[ORM\Table(name: 'player')]
class Player implements EntityUuidInterface
{
    use EntityUuidTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id;

    #[ORM\Column(length: 200)]
    private string $name;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false)]
    private User $user;

    /** @var Collection<int, CelestialBody> */
    #[ORM\OneToMany(targetEntity: CelestialBody::class, mappedBy: 'owner')]
    private Collection $celestialBodies;

    public function __construct()
    {
        $this->celestialBodies = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): self
    {
        $this->id = $id;

        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): Player
    {
        $this->user = $user;

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
            $celestialBody->setOwner($this);
        }

        return $this;
    }

    public function removeCelestialBody(CelestialBody $celestialBody): static
    {
        if ($this->celestialBodies->removeElement($celestialBody) && $celestialBody->getOwner() === $this)
        {
            $celestialBody->setOwner(null);
        }

        return $this;
    }
}
