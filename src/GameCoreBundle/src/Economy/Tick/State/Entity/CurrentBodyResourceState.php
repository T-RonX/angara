<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Entity;

use App\GameCoreBundle\Economy\Tick\State\Repository\EconomyStateRepository;
use App\GameCoreBundle\World\Entity\World;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Current Layer 0 (physical) + Layer 1 (production) state of one resource on one
 * celestial body. This is a derived read model: exactly one row exists per
 * (world, system, body, material) and it is overwritten every tick, so the table
 * always reflects the latest tick and never grows with history.
 */
#[Exclude]
#[ORM\Entity(repositoryClass: EconomyStateRepository::class)]
#[ORM\Table(name: 'current_body_resource_state')]
#[ORM\UniqueConstraint(name: 'uniq_current_body_state', columns: ['world_id', 'system_identifier', 'body_identifier', 'material_identifier'])]
#[ORM\Index(name: 'idx_current_body_state_world_material', columns: ['world_id', 'material_identifier'])]
class CurrentBodyResourceState
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    public function __construct(
        #[ORM\ManyToOne(targetEntity: World::class)]
        #[ORM\JoinColumn(name: 'world_id', referencedColumnName: 'id', nullable: false)]
        public readonly World $world,

        #[ORM\Column]
        public readonly int $tick,

        #[ORM\Column(length: 100)]
        public readonly string $systemIdentifier,

        #[ORM\Column(length: 100)]
        public readonly string $bodyIdentifier,

        #[ORM\Column(length: 100)]
        public readonly string $materialIdentifier,

        #[ORM\Column]
        public readonly float $physicalSupply,

        #[ORM\Column]
        public readonly float $depletionRate,

        #[ORM\Column]
        public readonly float $ticksLeft,

        #[ORM\Column]
        public readonly float $decayedStock,

        #[ORM\Column]
        public readonly float $supply,

        #[ORM\Column]
        public readonly float $demand,

        #[ORM\Column]
        public readonly float $surplus,

        #[ORM\Column]
        public readonly float $deficit,

        #[ORM\Column]
        public readonly float $imbalance,

        #[ORM\Column]
        public readonly float $ticksToFullOrEmpty,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
