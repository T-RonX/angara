import { CellTopology } from './CellTopology.js';
import { GoldbergGrid } from './goldberg/GoldbergGrid.js';
import { CentroidIndex } from './goldberg/CentroidIndex.js';
import { GoldbergSurfacePicker } from './goldberg/GoldbergSurfacePicker.js';
import { GoldbergCutStrategy } from './goldberg/GoldbergCutStrategy.js';
import { GoldbergBroadPhase } from './goldberg/GoldbergBroadPhase.js';
import { GoldbergTraversal } from './goldberg/GoldbergTraversal.js';
import { GoldbergGridLines } from './goldberg/GoldbergGridLines.js';
import { CellSliceBuilder } from './goldberg/CellSliceBuilder.js';
import { WholeCellResourceHighlight } from './goldberg/WholeCellResourceHighlight.js';
import { ShapeField } from '../model/ShapeField.js';

// ----------------------------------------------------------------------
// GoldbergTopology — the hexsphere: a Goldberg polyhedron (mostly hexagons +
// exactly 12 pentagons, NO poles), assembled behind the CellTopology
// contract. Because it has no poles it needs none of the polar-cap / latitude
// workaround; every cell is a uniform N-gon prism flowing through the shared
// generic geometry, cross-section, picking, camera and HUD code.
//
// It exposes the full topology contract directly, so BodyExplorer can wire
// the hexsphere without any lon/lat branch.
// ----------------------------------------------------------------------
export class GoldbergTopology extends CellTopology
{
    #planet;
    #grid;
    #index;
    #cutStrategy;
    #traversal;
    #shapeField;
    #fadeMs;
    #horizonCull;
    #wallBandCells;
    #profileSlice;
    #profileEvery;

    constructor(physical, layerModel, behaviour, atmosphereRadius, faceData = null)
    {
        super();

        this.#planet = physical.planet;

        const frequency = physical.planet.hexFrequency ?? 16;

        this.#shapeField = new ShapeField(physical.planet.shape, physical.planet.radius);

        this.#grid = new GoldbergGrid(
            this.#planet, layerModel, physical.atmosphere, atmosphereRadius, frequency, this.#shapeField, faceData,
        );

        this.#index = new CentroidIndex(this.#grid.surfaceCells);
        this.#cutStrategy = new GoldbergCutStrategy();
        this.#traversal = new GoldbergTraversal(this.#index, this.#grid.surfaceByIndex, behaviour.input);
        this.#fadeMs = behaviour?.slice?.cellFadeMs ?? 260;
        this.#horizonCull = behaviour?.slice?.horizonCull ?? { enabled: false, marginDeg: 6 };
        this.#wallBandCells = behaviour?.slice?.wallBandCells ?? 4;
        this.#profileSlice = behaviour?.debug?.profileSlice ?? false;
        this.#profileEvery = behaviour?.debug?.profileEvery ?? 30;
    }

    get grid()        { return this.#grid; }
    get cutStrategy() { return this.#cutStrategy; }
    get traversal()   { return this.#traversal; }
    get shapeField()  { return this.#shapeField; }

    createSurfacePicker(surfaceMesh, bodyGroup = null)
    {
        return new GoldbergSurfacePicker(this.#planet, this.#index, this.#shapeField, surfaceMesh, bodyGroup);
    }

    createBroadPhase()
    {
        return new GoldbergBroadPhase();
    }

    createSliceBuilder(ctx)
    {
        return new CellSliceBuilder({
            ...ctx,
            fadeMs: this.#fadeMs,
            planetRadius: this.#planet.radius,
            horizonCull: this.#horizonCull,
            wallBandCells: this.#wallBandCells,
            profileSlice: this.#profileSlice,
            profileEvery: this.#profileEvery,
        });
    }

    createResourceHighlight(deps)
    {
        return new WholeCellResourceHighlight(deps.geometryFactory);
    }

    buildGridLines()
    {
        return new GoldbergGridLines(this.#planet, this.#grid.faces, this.#shapeField).lines;
    }

    cellTypeLabel(cell)
    {
        if (cell.isAtmosphere) return 'atmosphere';

        const shape = cell.sides === 5 ? 'pentagon' : 'hexagon';

        return cell.depth === 0 ? `surface ${shape}` : `crust ${shape}`;
    }
}
