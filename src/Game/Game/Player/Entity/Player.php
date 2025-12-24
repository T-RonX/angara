<?php

declare(strict_types=1);

namespace App\Game\Game\Player\Entity;

use App\Game\Game\Player\Repository\PlayerRepository;
use App\System\Doctrine\Uuid\Entity\EntityUuidInterface;
use App\System\Doctrine\Uuid\Entity\EntityUuidTrait;
use App\System\User\Entity\User;
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

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'user')]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false)]
    private User $user;

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
}
