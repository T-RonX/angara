import * as THREE from 'three';
import { RAD2DEG } from '../../core/MathUtils.js';
import { GoldbergSphere } from './GoldbergSphere.js';

// ----------------------------------------------------------------------
// GoldbergGrid — the CellGrid equivalent for the hexsphere. It takes the
// unit-sphere Goldberg faces and extrudes each into the per-depth N-gon
// PRISM cell records the rest of the renderer already understands (an outer
// ring + a matching inner ring, `corners = outer++inner`). It exposes the
// same public surface as CellGrid — `cells`, `cellsByDepth`, `atmosphereCells`
// — plus the surface tables used by picking / traversal.
//
// There are NO caps: the Goldberg polyhedron has no poles, so the pole
// workaround simply does not exist here and every cell flows through the
// generic prism geometry / cross-section path.
// ----------------------------------------------------------------------
export class GoldbergGrid
{
    cells = [];
    cellsByDepth = [];
    atmosphereCells = [];

    surfaceCells = [];             // depth-0 cells (used for picking + snapping)
    surfaceByIndex = new Map();    // cellIndex → depth-0 cell (neighbour walks)

    #faces;
    #shapeField;
    #coreRadius;
    #minSurface;

    constructor(planet, layerModel, atmosphere, atmosphereRadius, frequency, shapeField)
    {
        this.#faces = new GoldbergSphere(frequency).faces;
        this.#shapeField = shapeField;
        this.#coreRadius = layerModel.coreRadius;

        // Never let a deep inward dent push the surface below (or into) the
        // core: keep at least 20% of the nominal crust so no layer inverts.
        const nominalCrust = planet.radius - layerModel.coreRadius;
        this.#minSurface = layerModel.coreRadius + 0.2 * nominalCrust;

        this.#buildCrustCells(layerModel);
        this.#buildSurfaceLookup();

        if (atmosphere.selectable && atmosphere.show)
        {
            this.#buildAtmosphereCells(planet.radius, atmosphereRadius);
        }
    }

    get faces() { return this.#faces; }

    #buildCrustCells(layerModel)
    {
        const { maxDepth, layerFrac } = layerModel;

        for (let d = 0; d < maxDepth; d++)
        {
            this.cellsByDepth[d] = [];

            const fracOuter = layerFrac[d];
            const fracInner = layerFrac[d + 1];

            // Scale the crust column between the FIXED core and the (possibly
            // displaced) surface radius in each corner's direction.
            const outerR = u => this.#layerRadius(u, fracOuter);
            const innerR = u => this.#layerRadius(u, fracInner);

            for (const face of this.#faces)
            {
                const cell = this.#prismCell(face, d, outerR, innerR);

                this.cells.push(cell);
                this.cellsByDepth[d].push(cell);
            }
        }
    }

    // Radius of a crust layer boundary in direction `u`: core + frac·(surface − core).
    #layerRadius(u, frac)
    {
        const surface = Math.max(this.#shapeField.surfaceRadius(u), this.#minSurface);

        return this.#coreRadius + frac * (surface - this.#coreRadius);
    }

    #buildAtmosphereCells(planetRadius, atmosphereRadius)
    {
        // Atmosphere cells sit on the (displaced) surface and rise to the
        // spherical atmosphere radius.
        const outerR = () => atmosphereRadius;
        const innerR = u => Math.max(this.#shapeField.surfaceRadius(u), this.#minSurface);

        for (const face of this.#faces)
        {
            const cell = this.#prismCell(face, 0, outerR, innerR);
            cell.isAtmosphere = true;
            this.atmosphereCells.push(cell);
        }
    }

    #buildSurfaceLookup()
    {
        for (const cell of this.cellsByDepth[0])
        {
            this.surfaceCells.push(cell);
            this.surfaceByIndex.set(cell.cellIndex, cell);
        }
    }

    // Extrude one Goldberg face into an N-gon prism cell at a given depth. The
    // outer / inner ring radius is evaluated PER CORNER via the supplied
    // functions, so a displaced (irregular) body shares corner radii exactly
    // between adjacent cells (no cracks) while a sphere returns a constant.
    #prismCell(face, depth, outerRadiusForDir, innerRadiusForDir)
    {
        const outerRing = face.corners.map(u => u.clone().multiplyScalar(outerRadiusForDir(u)));
        const innerRing = face.corners.map(u => u.clone().multiplyScalar(innerRadiusForDir(u)));
        const { lon, lat } = lonLatFromDir(face.dir);

        return {
            kind: face.sides === 5 ? 'pentagon' : 'hexagon',
            sides: face.sides,
            cellIndex: face.index,
            depth,
            lon,
            lat,
            centroidDir: face.dir,
            neighbors: face.neighbors,
            corners: outerRing.concat(innerRing),
            outerRing,
            innerRing,
            geom: null,
            edges: null,
        };
    }
}

// Longitude (0..360) / latitude (-90..90) of a unit direction, matching the
// convention of MathUtils.sphere (longitude winds around +Y).
export function lonLatFromDir(dir)
{
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * RAD2DEG;
    let lon = Math.atan2(dir.z, dir.x) * RAD2DEG;

    if (lon < 0) lon += 360;

    return { lon, lat };
}
