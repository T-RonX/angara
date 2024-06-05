<?php

declare(strict_types=1);

namespace App\Game\Player\Entity;

use App\Doctrine\Uuid\Entity\EntityUuidInterface;
use App\Doctrine\Uuid\Entity\EntityUuidTrait;
use App\Game\Player\Repository\PlayerRepository;
use App\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

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
