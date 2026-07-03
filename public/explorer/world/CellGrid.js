import { sphere } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// CellGrid — the BOOK-KEEPING for every cell of the body. It produces the
// flat cell records (quad cells + one round cap cell per pole, per depth),
// groups them by depth, builds the optional atmosphere shell cells, and
// keeps the fast surface lookup tables used by analytical picking.
//
// It holds DATA only: no meshes, no materials. BodyMesh turns these
// records into renderable geometry; the slicing / picking code reads them.
// ----------------------------------------------------------------------
export class CellGrid
{
    cells = [];          // flat list of every crust cell
    cellsByDepth = [];   // cellsByDepth[d] = cells at that depth
    atmosphereCells = []; // optional selectable atmosphere shell cells

    // Surface (depth-0) lookup for O(1) analytical picking.
    surfaceQuadLookup;
    surfaceCapNorth = null;
    surfaceCapSouth = null;

    #planet;
    #layerModel;
    #capModel;

    constructor(planet, layerModel, capModel, atmosphere, atmosphereRadius)
    {
        this.#planet = planet;
        this.#layerModel = layerModel;
        this.#capModel = capModel;

        this.#buildCrustCells();
        this.#buildSurfaceLookup();

        if (atmosphere.selectable && atmosphere.show)
        {
            this.#buildAtmosphereCells(atmosphereRadius);
        }
    }

    #buildCrustCells()
    {
        const { lonCells, latCells } = this.#planet;
        const { maxDepth, layerRadii } = this.#layerModel;
        const { capRows, rowDegLat, capBoundaryLatN, capBoundaryLatS, capFan } = this.#capModel;

        for (let d = 0; d < maxDepth; d++)
        {
            this.cellsByDepth[d] = [];

            const rOuter = layerRadii[d];
            const rInner = layerRadii[d + 1];

            // Quad cells (the non-cap latitude band).
            for (let j = capRows; j < latCells - capRows; j++)
            {
                const lat0 = -90 + j * rowDegLat;
                const lat1 = -90 + (j + 1) * rowDegLat;

                for (let i = 0; i < lonCells; i++)
                {
                    const lon0 = (i / lonCells) * 360;
                    const lon1 = ((i + 1) / lonCells) * 360;

                    this.#addCell(d, {
                        kind: 'quad',
                        lon: (lon0 + lon1) / 2,
                        lat: (lat0 + lat1) / 2,
                        depth: d,
                        lonIdx: i,
                        latIdx: j,
                        corners: this.#hexCorners(lon0, lon1, lat0, lat1, rOuter, rInner),
                        geom: null,
                        edges: null,
                    });
                }
            }

            // Polar cap cells (one per pole, when enabled).
            if (capRows > 0)
            {
                for (const sign of [+1, -1])
                {
                    const boundaryLat = sign > 0 ? capBoundaryLatN : capBoundaryLatS;

                    this.#addCell(d, {
                        kind: 'cap',
                        sign,
                        boundaryLat,
                        rOuter,
                        rInner,
                        fan: capFan,
                        lon: 0,
                        lat: sign * (90 - capRows * rowDegLat / 2),
                        depth: d,
                        geom: null,
                        edges: null,
                    });
                }
            }
        }
    }

    #buildAtmosphereCells(atmosphereRadius)
    {
        const { lonCells, latCells, radius } = this.#planet;
        const { capRows, rowDegLat, capBoundaryLatN, capBoundaryLatS, capFan } = this.#capModel;

        const rOuter = atmosphereRadius;
        const rInner = radius;

        for (let j = capRows; j < latCells - capRows; j++)
        {
            const lat0 = -90 + j * rowDegLat;
            const lat1 = -90 + (j + 1) * rowDegLat;

            for (let i = 0; i < lonCells; i++)
            {
                const lon0 = (i / lonCells) * 360;
                const lon1 = ((i + 1) / lonCells) * 360;

                this.atmosphereCells.push({
                    kind: 'quad',
                    isAtmosphere: true,
                    lon: (lon0 + lon1) / 2,
                    lat: (lat0 + lat1) / 2,
                    depth: 0,
                    lonIdx: i,
                    latIdx: j,
                    corners: this.#hexCorners(lon0, lon1, lat0, lat1, rOuter, rInner),
                    geom: null,
                    edges: null,
                });
            }
        }

        if (capRows > 0)
        {
            for (const sign of [+1, -1])
            {
                this.atmosphereCells.push({
                    kind: 'cap',
                    isAtmosphere: true,
                    sign,
                    boundaryLat: sign > 0 ? capBoundaryLatN : capBoundaryLatS,
                    rOuter,
                    rInner,
                    fan: capFan,
                    lon: 0,
                    lat: sign * (90 - capRows * rowDegLat / 2),
                    depth: 0,
                    geom: null,
                    edges: null,
                });
            }
        }
    }

    #buildSurfaceLookup()
    {
        const { lonCells, latCells } = this.#planet;
        this.surfaceQuadLookup = new Array(latCells * lonCells).fill(null);

        for (const cell of this.cellsByDepth[0])
        {
            if (cell.kind === 'quad')
            {
                this.surfaceQuadLookup[cell.latIdx * lonCells + cell.lonIdx] = cell;
            }
            else if (cell.sign > 0)
            {
                this.surfaceCapNorth = cell;
            }
            else
            {
                this.surfaceCapSouth = cell;
            }
        }
    }

    #hexCorners(lon0, lon1, lat0, lat1, rOuter, rInner)
    {
        return [
            sphere(lon0, lat0, rOuter), sphere(lon1, lat0, rOuter),
            sphere(lon1, lat1, rOuter), sphere(lon0, lat1, rOuter),
            sphere(lon0, lat0, rInner), sphere(lon1, lat0, rInner),
            sphere(lon1, lat1, rInner), sphere(lon0, lat1, rInner),
        ];
    }

    #addCell(depth, cell)
    {
        this.cells.push(cell);
        this.cellsByDepth[depth].push(cell);
    }
}

