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

    constructor(planet, layerModel, atmosphere, atmosphereRadius, frequency, shapeField, faceData = null)
    {
        // Prefer the worker's precomputed faces (rehydrated cheaply) when
        // available; otherwise compute them synchronously (fallback path).
        this.#faces = faceData
            ? GoldbergSphere.fromFaceData(faceData).faces
            : new GoldbergSphere(frequency).faces;
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
        const { maxDepth, layerThicknesses } = layerModel;

        for (let d = 0; d < maxDepth; d++)
        {
            this.cellsByDepth[d] = [];

            const cumulativeThicknessOuter = layerThicknesses.slice(0, d).reduce((sum, t) => sum + t, 0);
            const cumulativeThicknessInner = cumulativeThicknessOuter + layerThicknesses[d];

            // Surface follows displacement, but layers maintain uniform absolute thickness.
            // Each layer is offset downward from the (displaced) surface by cumulative thickness.
            const outerR = u => this.#layerRadius(u, cumulativeThicknessOuter);
            const innerR = u => this.#layerRadius(u, cumulativeThicknessInner);

            for (const face of this.#faces)
            {
                const cell = this.#prismCell(face, d, outerR, innerR);

                this.cells.push(cell);
                this.cellsByDepth[d].push(cell);
            }
        }
    }

    // Radius of a crust layer boundary in direction `u`: displaced surface minus
    // cumulative thickness. Layers maintain uniform absolute thickness.
    #layerRadius(u, cumulativeThickness)
    {
        const surface = Math.max(this.#shapeField.surfaceRadius(u), this.#minSurface);

        return surface - cumulativeThickness;
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
        const { lon, lat } = lonLatFromDir(face.dir);

        // The corner rings are the dominant allocation at high hexFrequency
        // (~10M Vector3 across all depths) and are only ever needed for the
        // handful of cells a slice actually renders — membership tests use only
        // `centroidDir`. They are therefore built LAZILY on first access.
        //
        // CRITICAL: the lazy accessors live on GoldbergCell's PROTOTYPE, not as
        // per-instance `Object.defineProperties` (which measured ~14x slower to
        // construct and ~5x more retained memory at f=128 — the source of both
        // the slow load and GC-driven frame drops). Construction here is just
        // plain field assignment.
        return new GoldbergCell(face, depth, lon, lat, outerRadiusForDir, innerRadiusForDir);
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

// ----------------------------------------------------------------------
// GoldbergCell — one N-gon prism cell record. Its data fields are assigned
// eagerly (cheap), but the heavy corner rings (`outerRing` / `innerRing` /
// `corners`) are exposed as LAZY getters on the PROTOTYPE — defined once for
// the whole class, so constructing the ~800k cells at f=128 is plain field
// assignment (measured ~10x faster and ~6x less memory than per-instance
// Object.defineProperties). The rings materialise on first access (only for
// the cells a slice actually renders) and are cached thereafter.
//
// The public shape is identical to the old plain object, so every consumer
// (CellGeometryFactory, CrossSectionFactory, CentroidIndex, CrustCamera,
// HighlightManager, CellSliceBuilder) is unchanged; dynamic props they add
// (`sliceCentroid`, `triCount`, `isAtmosphere`, `geom`, `edges`) still work.
// ----------------------------------------------------------------------
class GoldbergCell
{
    constructor(face, depth, lon, lat, outerRadiusForDir, innerRadiusForDir)
    {
        this.kind = face.sides === 5 ? 'pentagon' : 'hexagon';
        this.sides = face.sides;
        this.cellIndex = face.index;
        this.depth = depth;
        this.lon = lon;
        this.lat = lat;
        this.centroidDir = face.dir;
        this.neighbors = face.neighbors;
        this.geom = null;
        this.edges = null;

        this._face = face;
        this._outerR = outerRadiusForDir;
        this._innerR = innerRadiusForDir;
        this._outerRing = null;
        this._innerRing = null;
        this._corners = null;
    }

    get outerRing()
    {
        return this._outerRing ??= this._face.corners.map(u => u.clone().multiplyScalar(this._outerR(u)));
    }

    get innerRing()
    {
        return this._innerRing ??= this._face.corners.map(u => u.clone().multiplyScalar(this._innerR(u)));
    }

    get corners()
    {
        return this._corners ??= this.outerRing.concat(this.innerRing);
    }
}
