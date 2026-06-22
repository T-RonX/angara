<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\DependencyInjection\Attribute\Exclude;

/**
 * A single line of a {@see MaterialRecipe}: a material, a quantity and whether it
 * is consumed (input) or produced (output).
 */
#[Exclude]
#[ORM\Entity]
#[ORM\Table(name: 'material_recipe_item')]
class MaterialRecipeItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: MaterialRecipe::class, inversedBy: 'items')]
    #[ORM\JoinColumn(name: 'recipe_id', referencedColumnName: 'id', nullable: false)]
    private MaterialRecipe $recipe;

    #[ORM\ManyToOne(targetEntity: Material::class)]
    #[ORM\JoinColumn(name: 'material_id', referencedColumnName: 'id', nullable: false)]
    private Material $material;

    #[ORM\Column]
    private int $quantity;

    #[ORM\Column(enumType: RecipeItemRole::class)]
    private RecipeItemRole $role;

    public function __construct(Material $material, int $quantity, RecipeItemRole $role)
    {
        $this->material = $material;
        $this->quantity = $quantity;
        $this->role = $role;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getRecipe(): MaterialRecipe
    {
        return $this->recipe;
    }

    public function setRecipe(MaterialRecipe $recipe): static
    {
        $this->recipe = $recipe;

        return $this;
    }

    public function getMaterial(): Material
    {
        return $this->material;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function getRole(): RecipeItemRole
    {
        return $this->role;
    }
}

