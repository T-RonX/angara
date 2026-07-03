import { CellTopology } from './CellTopology.js';
import { GoldbergGrid } from './goldberg/GoldbergGrid.js';
import { CentroidIndex } from './goldberg/CentroidIndex.js';
import { GoldbergSurfacePicker } from './goldberg/GoldbergSurfacePicker.js';
import { GoldbergCutStrategy } from './goldberg/GoldbergCutStrategy.js';
import { GoldbergBroadPhase } from './goldberg/GoldbergBroadPhase.js';
import { GoldbergTraversal } from './goldberg/GoldbergTraversal.js';
import { GoldbergGridLines } from './goldberg/GoldbergGridLines.js';

// ----------------------------------------------------------------------
// GoldbergTopology — the hexsphere: a Goldberg polyhedron (mostly hexagons +
// exactly 12 pentagons, NO poles), assembled behind the CellTopology
// contract. Because it has no poles it needs none of the polar-cap / latitude
// workaround; every cell is a uniform N-gon prism flowing through the shared
// generic geometry, cross-section, picking, camera and HUD code.
//
// It mirrors LonLatTopology's public surface exactly, so BodyExplorer wires
// it identically — the whole scheme swaps via one config flag.
// ----------------------------------------------------------------------
export class GoldbergTopology extends CellTopology
{
    #planet;
    #grid;
    #index;
    #cutStrategy;
    #traversal;

    constructor(physical, layerModel, behaviour, atmosphereRadius)
    {
        super();

        this.#planet = physical.planet;

        const frequency = physical.planet.hexFrequency ?? 16;

        this.#grid = new GoldbergGrid(
            this.#planet, layerModel, physical.atmosphere, atmosphereRadius, frequency,
        );

        this.#index = new CentroidIndex(this.#grid.surfaceCells);
        this.#cutStrategy = new GoldbergCutStrategy();
        this.#traversal = new GoldbergTraversal(this.#index, this.#grid.surfaceByIndex);
    }

    get grid()        { return this.#grid; }
    get cutStrategy() { return this.#cutStrategy; }
    get traversal()   { return this.#traversal; }

    createSurfacePicker()
    {
        return new GoldbergSurfacePicker(this.#planet, this.#index);
    }

    createBroadPhase()
    {
        return new GoldbergBroadPhase();
    }

    buildGridLines()
    {
        return new GoldbergGridLines(this.#planet, this.#grid.faces).lines;
    }

    cellTypeLabel(cell)
    {
        if (cell.isAtmosphere) return 'atmosphere';

        const shape = cell.sides === 5 ? 'pentagon' : 'hexagon';

        return cell.depth === 0 ? `surface ${shape}` : `crust ${shape}`;
    }
}
