import { GoldbergGrid } from './goldberg/GoldbergGrid.js';
import { CentroidIndex } from './goldberg/CentroidIndex.js';
import { GoldbergSurfacePicker } from './goldberg/GoldbergSurfacePicker.js';
import { GoldbergCutStrategy } from './goldberg/GoldbergCutStrategy.js';
import { GoldbergTraversal } from './goldberg/GoldbergTraversal.js';
import { GoldbergGridLines } from './goldberg/GoldbergGridLines.js';
import { CellSliceBuilder } from './goldberg/CellSliceBuilder.js';
import { WholeCellResourceHighlight } from './goldberg/WholeCellResourceHighlight.js';
import { ShapeField } from '../model/ShapeField.js';

// ----------------------------------------------------------------------
// GoldbergTopology -- the hexsphere: a Goldberg polyhedron (mostly hexagons +
// exactly 12 pentagons, NO poles). Every cell is a uniform N-gon prism
// flowing through the shared generic geometry, picking, camera and HUD code.
//
// It exposes the full topology contract directly, so the orchestrator can
// wire the hexsphere without any special-case branches.
// ----------------------------------------------------------------------
export class GoldbergTopology
{
    #body;
    #grid;
    #index;
    #cutStrategy;
    #traversal;
    #shapeField;
    #fadeMs;
    #wallBandCells;
    #viewCull;

    constructor(body, layerModel, atmosphere, atmosphereRadius, behaviour, faceData = null)
    {
        this.#body = body;

        const frequency = body.hexFrequency ?? 16;

        this.#shapeField = new ShapeField(body.shape, body.radius, body.seed, body.terrain);

        this.#grid = new GoldbergGrid(
            this.#body, layerModel, atmosphere, atmosphereRadius, frequency, this.#shapeField, faceData,
        );

        this.#index = new CentroidIndex(this.#grid.surfaceCells);
        this.#cutStrategy = new GoldbergCutStrategy();
        this.#traversal = new GoldbergTraversal(this.#index, this.#grid.surfaceByIndex, behaviour.input);
        this.#fadeMs = behaviour?.slice?.cellFadeMs ?? 260;
        this.#wallBandCells = behaviour?.slice?.wallBandCells ?? 4;
        this.#viewCull = behaviour?.slice?.viewCull ?? {
            enabled: true,
            paddingCells: 2,
        };
    }

    get grid()        { return this.#grid; }
    get cutStrategy() { return this.#cutStrategy; }
    get traversal()   { return this.#traversal; }
    get shapeField()  { return this.#shapeField; }

    createSurfacePicker(surfaceMesh, bodyGroup = null)
    {
        return new GoldbergSurfacePicker(this.#body, this.#index, this.#shapeField, surfaceMesh, bodyGroup);
    }

    createSliceBuilder(ctx)
    {
        return new CellSliceBuilder({
            ...ctx,
            fadeMs: this.#fadeMs,
            bodyRadius: this.#body.radius,
            skirtStretch: this.#body.coreSkirt?.stretch ?? 0.4,
            wallBandCells: this.#wallBandCells,
            viewCull: this.#viewCull,
        });
    }

    createResourceHighlight(deps)
    {
        return new WholeCellResourceHighlight(deps.geometryFactory);
    }

    buildGridLines()
    {
        return new GoldbergGridLines(this.#body, this.#grid.faces, this.#shapeField).lines;
    }

    cellTypeLabel(cell)
    {
        if (cell.isAtmosphere) return 'atmosphere';

        const shape = cell.sides === 5 ? 'pentagon' : 'hexagon';

        return cell.depth === 0 ? `surface ${shape}` : `crust ${shape}`;
    }
}
