<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Tick\State\Entity;

use App\GameCoreBundle\World\Entity\World;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Current per-system aggregate of one resource, including its derived local
 * scarcity index and local price (Layer 1 -> local pricing). One row per
 * (world, system, material), overwritten every tick.
 */
#[Exclude]
#[ORM\Entity]
#[ORM\Table(name: 'current_system_resource_summary')]
#[ORM\UniqueConstraint(name: 'uniq_current_system_summary', columns: ['world_id', 'system_identifier', 'material_identifier'])]
#[ORM\Index(name: 'idx_current_system_summary_world_material', columns: ['world_id', 'material_identifier'])]
class CurrentSystemResourceSummary
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
        public readonly string $materialIdentifier,

        #[ORM\Column]
        public readonly float $supply,

        #[ORM\Column]
        public readonly float $demand,

        #[ORM\Column]
        public readonly float $imbalance,

        #[ORM\Column]
        public readonly float $localScarcityIndex,

        #[ORM\Column]
        public readonly float $localPrice,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
