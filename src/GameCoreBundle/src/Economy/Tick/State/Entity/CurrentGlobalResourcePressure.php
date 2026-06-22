<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Entity;

use App\GameCoreBundle\World\Entity\World;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Current world-wide totals and the Layer 4 pressure result for one resource.
 * One row per (world, material), overwritten every tick.
 */
#[Exclude]
#[ORM\Entity]
#[ORM\Table(name: 'current_global_resource_pressure')]
#[ORM\UniqueConstraint(name: 'uniq_current_global_pressure', columns: ['world_id', 'material_identifier'])]
#[ORM\Index(name: 'idx_current_global_pressure_world_material', columns: ['world_id', 'material_identifier'])]
class CurrentGlobalResourcePressure
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
        public readonly string $materialIdentifier,

        #[ORM\Column]
        public readonly float $totalSupply,

        #[ORM\Column]
        public readonly float $totalDemand,

        #[ORM\Column]
        public readonly float $totalImbalance,

        #[ORM\Column]
        public readonly float $scarcityIndex,

        #[ORM\Column]
        public readonly float $desiredScarcityIndex,

        #[ORM\Column]
        public readonly float $pressure,

        #[ORM\Column]
        public readonly float $nudge,

        #[ORM\Column]
        public readonly float $introduce,

        #[ORM\Column]
        public readonly float $expire,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
