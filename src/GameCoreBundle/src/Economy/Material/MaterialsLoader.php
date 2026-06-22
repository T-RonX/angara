<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material;

use App\GameCoreBundle\Economy\Material\Entity\MaterialRecipe;
use App\GameCoreBundle\Economy\Material\Entity\RecipeItemRole;
use App\GameCoreBundle\Economy\Material\Exception\MaterialAlreadyRegisteredException;
use App\GameCoreBundle\Economy\Material\Exception\MaterialUnregisteredException;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRecipeRepository;
use App\GameCoreBundle\Economy\Material\Repository\MaterialRepository;

/**
 * Loads the material catalog from the database into the in-memory lookup model:
 * a {@see MaterialCollection} of the material entities and the derived
 * {@see MaterialProcesses}. The model is built once and cached for the lifetime
 * of the service.
 */
class MaterialsLoader
{
    private ?MaterialCollection $materials = null;
    private ?MaterialProcesses $processes = null;

    public function __construct(
        private readonly MaterialRepository $materialRepository,
        private readonly MaterialRecipeRepository $materialRecipeRepository,
    ) {
    }

    /**
     * @throws MaterialAlreadyRegisteredException|MaterialUnregisteredException
     */
    public function getMaterials(): MaterialCollection
    {
        $this->load();

        return $this->materials;
    }

    /**
     * @throws MaterialAlreadyRegisteredException|MaterialUnregisteredException
     */
    public function getProcesses(): MaterialProcesses
    {
        $this->load();

        return $this->processes;
    }

    /**
     * @throws MaterialAlreadyRegisteredException|MaterialUnregisteredException
     */
    private function load(): void
    {
        if ($this->materials !== null)
        {
            return;
        }

        $materials = new MaterialCollection();
        foreach ($this->materialRepository->findAll() as $material)
        {
            $materials->add($material);
        }

        $processes = new MaterialProcesses($materials);
        foreach ($this->materialRecipeRepository->findAll() as $recipe)
        {
            $processes->add($this->toProcess($recipe));
        }

        $this->materials = $materials;
        $this->processes = $processes;
    }


    private function toProcess(MaterialRecipe $recipe): MaterialProcess
    {
        $inputs = [];
        $outputs = [];

        foreach ($recipe->getItems() as $item)
        {
            $identifier = $item->getMaterial()->getIdentifier();

            if ($item->getRole() === RecipeItemRole::Input)
            {
                $inputs[] = new MaterialInput($identifier, $item->getQuantity());

                continue;
            }

            $outputs[] = new MaterialOutput($identifier, $item->getQuantity());
        }

        return new MaterialProcess(new MaterialInputs($inputs), new MaterialOutputs($outputs));
    }
}

