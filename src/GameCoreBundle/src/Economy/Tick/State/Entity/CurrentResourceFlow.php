<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Entity;

use App\GameCoreBundle\Economy\Tick\Report\FlowScope;
use App\GameCoreBundle\World\Entity\World;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Current distribution of a resource, either between objects of a system (Layer 2)
 * or between systems (Layer 3). Recomputed and overwritten every tick.
 */
#[Exclude]
#[ORM\Entity]
#[ORM\Table(name: 'current_resource_flow')]
#[ORM\Index(name: 'idx_current_flow_world_material', columns: ['world_id', 'material_identifier'])]
class CurrentResourceFlow
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

        #[ORM\Column(enumType: FlowScope::class)]
        public readonly FlowScope $scope,

        #[ORM\Column(length: 100)]
        public readonly string $materialIdentifier,

        #[ORM\Column(length: 100)]
        public readonly string $fromIdentifier,

        #[ORM\Column(length: 100)]
        public readonly string $toIdentifier,

        #[ORM\Column]
        public readonly float $amount,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
