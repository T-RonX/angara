<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use App\GameCoreBundle\Economy\Material\Repository\MaterialRecipeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * Persistent production recipe (the "Components" / process model of GameFlow):
 * a set of input materials that yields a set of output materials.
 */
#[Exclude]
#[ORM\Entity(repositoryClass: MaterialRecipeRepository::class)]
#[ORM\Table(name: 'material_recipe')]
class MaterialRecipe
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** @var Collection<int, MaterialRecipeItem> */
    #[ORM\OneToMany(targetEntity: MaterialRecipeItem::class, mappedBy: 'recipe', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $items;

    public function __construct()
    {
        $this->items = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * @return Collection<int, MaterialRecipeItem>
     */
    public function getItems(): Collection
    {
        return $this->items;
    }

    public function addItem(MaterialRecipeItem $item): static
    {
        if (!$this->items->contains($item))
        {
            $this->items->add($item);
            $item->setRecipe($this);
        }

        return $this;
    }
}

