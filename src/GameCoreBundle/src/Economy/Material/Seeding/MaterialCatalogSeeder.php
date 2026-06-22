<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Seeding;

use App\GameCoreBundle\Economy\Material\Entity\ComponentMaterial;
use App\GameCoreBundle\Economy\Material\Entity\Material;
use App\GameCoreBundle\Economy\Material\Entity\MaterialRecipe;
use App\GameCoreBundle\Economy\Material\Entity\MaterialRecipeItem;
use App\GameCoreBundle\Economy\Material\Entity\RawMaterial;
use App\GameCoreBundle\Economy\Material\Entity\RecipeItemRole;
use App\GameCoreBundle\Economy\Material\Entity\RefinedMaterial;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRecipeRepository;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRepository;
use App\GameCoreBundle\Economy\Material\Type\MaterialType;
use App\GameCoreBundle\Economy\Material\Type\RawMaterialType;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Seeds the material catalog (materials + production recipes) into the database.
 * This is the persisted form of what used to be hard-coded in MaterialsLoader.
 */
final class MaterialCatalogSeeder
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly MaterialRepository $materialRepository,
        private readonly MaterialRecipeRepository $materialRecipeRepository,
    ) {
    }

    /**
     * @return int the number of materials seeded
     */
    public function seed(): int
    {
        $this->removeExisting();

        /** @var array<string, Material> $materials */
        $materials = [];
        foreach ($this->materialDefinitions() as $definition)
        {
            $material = $this->buildMaterial($definition);
            $this->entityManager->persist($material);
            $materials[$material->getIdentifier()] = $material;
        }

        foreach ($this->recipeDefinitions() as [$inputs, $outputs])
        {
            $recipe = new MaterialRecipe();

            foreach ($inputs as $identifier => $quantity)
            {
                $recipe->addItem(new MaterialRecipeItem($materials[$identifier], $quantity, RecipeItemRole::Input));
            }

            foreach ($outputs as $identifier => $quantity)
            {
                $recipe->addItem(new MaterialRecipeItem($materials[$identifier], $quantity, RecipeItemRole::Output));
            }

            $this->entityManager->persist($recipe);
        }

        $this->entityManager->flush();

        return count($materials);
    }

    /**
     * @param array{0: string, 1: MaterialType, 2: ?RawMaterialType, 3: float, 4: float, 5: float, 6: float} $definition
     */
    private function buildMaterial(array $definition): Material
    {
        [$identifier, $type, $rawType, $desiredScarcityIndex, $basePrice, $priceScarcitySensitivity, $storageDecayRate] = $definition;

        $material = match ($type)
        {
            MaterialType::Raw => (new RawMaterial($identifier))
                ->setRawType($rawType ?? RawMaterialType::Deposit)
                ->setDesiredScarcityIndex($desiredScarcityIndex)
                ->setBasePrice($basePrice)
                ->setPriceScarcitySensitivity($priceScarcitySensitivity),
            MaterialType::Refined => (new RefinedMaterial($identifier))
                ->setDesiredScarcityIndex($desiredScarcityIndex)
                ->setBasePrice($basePrice)
                ->setPriceScarcitySensitivity($priceScarcitySensitivity),
            // Components have no market pricing of their own; cost is derived from the recipe.
            MaterialType::Component => new ComponentMaterial($identifier),
        };

        return $material->setStorageDecayRate($storageDecayRate);
    }

    /**
     * identifier, type, rawType, desiredScarcityIndex, basePrice, priceScarcitySensitivity, storageDecayRate.
     *
     * `iron` and `wood` carry the GameFlow "R1"/"R2" properties exactly (so the
     * demo world keeps reproducing the spreadsheet); the other raw materials get
     * plausible, hand-tuned values. Refined and component materials keep the
     * catalog defaults (SI 0, base price 1, sensitivity 0.5, decay 0).
     *
     * @return list<array{0: string, 1: MaterialType, 2: ?RawMaterialType, 3: float, 4: float, 5: float, 6: float}>
     */
    private function materialDefinitions(): array
    {
        return [
            // Raw materials -------------------------------------------------------
            ['iron',                     MaterialType::Raw,       RawMaterialType::Deposit, -0.1,  1.0, 1.0, 0.0],
            ['aluminium',                MaterialType::Raw,       RawMaterialType::Deposit, -0.05, 1.6, 0.9, 0.0],
            ['lithium',                  MaterialType::Raw,       RawMaterialType::Deposit, -0.05, 4.5, 1.6, 0.0],
            ['regolith',                 MaterialType::Raw,       RawMaterialType::Deposit, 0.0,   0.4, 0.6, 0.0],
            ['water',                    MaterialType::Raw,       RawMaterialType::Deposit, -0.1,  1.2, 1.1, 0.005],
            ['wood',                     MaterialType::Raw,       RawMaterialType::Flow,    -0.1,  2.0, 1.3, 0.02],
            // Refined materials ---------------------------------------------------
            ['wood_pallets',             MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            ['hydrogen',                 MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            ['oxygen',                   MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            ['steel',                    MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            ['silicon',                  MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            ['electrolyte',              MaterialType::Refined,   null,                     0.0,  1.0, 0.5, 0.0],
            // Component materials -------------------------------------------------
            ['battery',                  MaterialType::Component, null,                     0.0,  1.0, 0.5, 0.0],
            ['paper',                    MaterialType::Component, null,                     0.0,  1.0, 0.5, 0.0],
            ['reinforced_silicon_panel', MaterialType::Component, null,                     0.0,  1.0, 0.5, 0.0],
            ['rocket_fuel',              MaterialType::Component, null,                     0.0,  1.0, 0.5, 0.0],
        ];
    }

    /**
     * Each recipe is [inputs, outputs] where both are identifier => quantity maps.
     *
     * @return list<array{0: array<string, int>, 1: array<string, int>}>
     */
    private function recipeDefinitions(): array
    {
        return [
            [['wood' => 2], ['wood_pallets' => 1]],
            [['water' => 4], ['hydrogen' => 2, 'oxygen' => 1]],
            [['iron' => 2], ['steel' => 1]],
            [['regolith' => 2], ['silicon' => 1]],
            [['lithium' => 1], ['electrolyte' => 1]],
            [['aluminium' => 4, 'electrolyte' => 15], ['battery' => 1]],
            [['wood' => 1], ['paper' => 1]],
            [['steel' => 5, 'silicon' => 1], ['reinforced_silicon_panel' => 1]],
            [['hydrogen' => 1, 'oxygen' => 1], ['rocket_fuel' => 1]],
        ];
    }

    private function removeExisting(): void
    {
        foreach ($this->materialRecipeRepository->findAll() as $recipe)
        {
            $this->entityManager->remove($recipe);
        }

        $this->entityManager->flush();

        foreach ($this->materialRepository->findAll() as $material)
        {
            $this->entityManager->remove($material);
        }

        $this->entityManager->flush();
    }
}

