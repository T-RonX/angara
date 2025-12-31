<?php

declare(strict_types=1);

namespace App\SystemBundle\User\Entity;

use App\GameCoreBundle\Player\Entity\Player;
use App\SystemBundle\Doctrine\Uuid\Entity\EntityUuidInterface;
use App\SystemBundle\Doctrine\Uuid\Entity\EntityUuidTrait;
use App\SystemBundle\User\Repository\UserRepository;
use App\UserPreference\Entity\UserPreference;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[Exclude]
#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'user',)]
class User implements EntityUuidInterface, UserInterface, PasswordAuthenticatedUserInterface
{
    use EntityUuidTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id;

    #[ORM\Column(length: 200)]
    private string $username;

    #[ORM\Column(length: 60)]
    private string $password;

    /**
     * @var Collection<int, Player>
     */
    #[ORM\OneToMany(targetEntity: Player::class, mappedBy: 'user')]
    private Collection $player;

    public function __construct()
    {
        $this->player = new ArrayCollection();
    }

    public function setId(?int $id): self
    {
        $this->id = $id;

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setUsername(string $username): self
    {
        $this->username = $username;

        return $this;
    }

    public function getUsername(): string
    {
        return $this->username;
    }

    public function getUserIdentifier(): string
    {
        return $this->username;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function getRoles(): array
    {
        return [];
    }

    public function eraseCredentials(): void
    {

    }
}
