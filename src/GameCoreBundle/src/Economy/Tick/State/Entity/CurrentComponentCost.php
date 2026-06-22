<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Entity;

use App\GameCoreBundle\World\Entity\World;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Current representative production cost of one component within one system
 * (priced from that system's local prices). One row per (world, system,
 * component), overwritten every tick.
 */
#[Exclude]
#[ORM\Entity]
#[ORM\Table(name: 'current_component_cost')]
#[ORM\UniqueConstraint(name: 'uniq_current_component_cost', columns: ['world_id', 'system_identifier', 'component_identifier'])]
#[ORM\Index(name: 'idx_current_component_cost_world_component', columns: ['world_id', 'component_identifier'])]
class CurrentComponentCost
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
        public readonly string $componentIdentifier,

        #[ORM\Column]
        public readonly float $cost,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
