<?php

declare(strict_types=1);

namespace App\GameLogicBundle\Economy\Material;

use App\GameLogicBundle\Economy\Material\Type\Component\Component;
use App\GameLogicBundle\Economy\Material\Type\MaterialType;
use App\GameLogicBundle\Economy\Material\Type\Raw\Raw;
use App\GameLogicBundle\Economy\Material\Type\RawMaterialType;
use App\GameLogicBundle\Economy\Material\Type\Refined\Refined;
use GameLogicBundle\Economy\Materials\Exception\MaterialAlreadyRegisteredException;
use GameLogicBundle\Economy\Materials\Exception\MaterialUnregisteredException;

class MaterialsLoader
{
    public private(set) MaterialCollection $materials;
    public private(set) MaterialProcesses $processes;

    /**
     * @throws MaterialAlreadyRegisteredException|MaterialUnregisteredException
     */
    public function __construct()
    {
        $this->materials = new MaterialCollection()
            ->add(new Raw('aluminium', RawMaterialType::Deposit))
            ->add(new Raw('iron', RawMaterialType::Deposit))
            ->add(new Raw('lithium', RawMaterialType::Deposit))
            ->add(new Raw('regolith', RawMaterialType::Deposit))
            ->add(new Raw('water', RawMaterialType::Deposit))
            ->add(new Raw('wood', RawMaterialType::Flow))
            ->add(new Refined('wood_pallets'))
            ->add(new Refined('hydrogen'))
            ->add(new Refined('oxygen'))
            ->add(new Refined('steel'))
            ->add(new Refined('silicon'))
            ->add(new Refined('electrolyte'))
            ->add(new Component('battery'))
            ->add(new Component('paper'))
            ->add(new Component('reinforced_silicon_panel'))
            ->add(new Component('rocket_fuel'));

        $this->processes = new MaterialProcesses($this->materials)
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('wood', 2),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('wood_pallets', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('water', 4),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('hydrogen', 2),
                    new MaterialOutput('oxygen', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('iron', 2),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('steel', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('regolith', 2),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('silicon', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('lithium', 1),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('electrolyte', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('aluminium', 4),
                    new MaterialInput('electrolyte', 15),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('battery', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('wood', 1),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('paper', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('steel', 5),
                    new MaterialInput('silicon', 1),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('reinforced_silicon_panel', 1),
                ]),
            ))
            ->add(new MaterialProcess(
                new MaterialInputs([
                    new MaterialInput('hydrogen', 1),
                    new MaterialInput('oxygen', 1),
                ]),
                new MaterialOutputs([
                    new MaterialOutput('rocket_fuel', 1),
                ]),
            ));
    }
}
