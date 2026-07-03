import { CellTopology } from './CellTopology.js';
import { PolarCapModel } from '../model/PolarCapModel.js';
import { LatitudeStops } from '../model/LatitudeStops.js';
import { CellGrid } from '../world/CellGrid.js';
import { GridLines } from '../world/GridLines.js';
import { SurfacePicker } from '../picking/SurfacePicker.js';
import { CapBuilder } from '../slicing/CapBuilder.js';
import { LonLatCutStrategy } from './lonlat/LonLatCutStrategy.js';
import { LonLatBroadPhase } from './lonlat/LonLatBroadPhase.js';
import { LonLatTraversal } from './lonlat/LonLatTraversal.js';
import { LonLatResourceHighlight } from './lonlat/LonLatResourceHighlight.js';

// ----------------------------------------------------------------------
// LonLatTopology — the original longitude/latitude grid with polar caps,
// assembled behind the CellTopology contract. It owns the pole-workaround
// models (PolarCapModel, LatitudeStops) and wires the lon/lat cut, broad-
// phase, picker and traversal strategies. Behaviour is identical to the
// pre-abstraction renderer.
// ----------------------------------------------------------------------
export class LonLatTopology extends CellTopology
{
    #planet;
    #capModel;
    #latStops;
    #grid;
    #cutStrategy;
    #traversal;
    #traverseAxis;

    constructor(physical, layerModel, behaviour, atmosphereRadius)
    {
        super();

        this.#planet = physical.planet;
        this.#traverseAxis = behaviour.traversal.resourceTraverseAxis;

        this.#capModel = new PolarCapModel(this.#planet);
        this.#latStops = new LatitudeStops(this.#planet, this.#capModel);

        this.#grid = new CellGrid(
            this.#planet, layerModel, this.#capModel,
            physical.atmosphere, atmosphereRadius,
        );

        this.#cutStrategy = new LonLatCutStrategy(this.#traverseAxis, this.#capModel);
        this.#traversal = new LonLatTraversal(
            this.#planet, this.#capModel, this.#latStops, this.#traverseAxis, behaviour.input,
        );
    }

    get grid()        { return this.#grid; }
    get cutStrategy() { return this.#cutStrategy; }
    get traversal()   { return this.#traversal; }

    createSurfacePicker()
    {
        return new SurfacePicker(this.#planet, this.#capModel, this.#grid);
    }

    createBroadPhase()
    {
        return new LonLatBroadPhase(this.#planet, this.#capModel, this.#traverseAxis, this.#cutStrategy);
    }

    createSliceBuilder(ctx)
    {
        return new CapBuilder(ctx, this.createBroadPhase());
    }

    createResourceHighlight(deps)
    {
        return new LonLatResourceHighlight(
            deps.crossSection, deps.geometryFactory, deps.clip, this.#planet.polarCapRings,
        );
    }

    buildGridLines()
    {
        return new GridLines(this.#planet, this.#capModel).lines;
    }

    cellTypeLabel(cell)
    {
        if (cell.isAtmosphere) return 'atmosphere';
        if (cell.kind === 'cap') return 'polar cap';

        return cell.depth === 0 ? 'surface' : 'crust';
    }
}
