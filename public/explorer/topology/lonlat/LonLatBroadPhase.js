import { deg2rad, cellBounds } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// LonLatBroadPhase — narrows the cells the cut can cross so CapBuilder
// never tests the whole grid. It reproduces the fast lon/lat phases:
//   * meridian cut  : only the ~2 crossed longitude columns,
//   * tilted cut    : the ~1 latitude row per column the great circle hits,
//   * open-slice sweep (slab): a generalised bounding-sphere vs offset-plane
//     test (polar caps are skipped mid-sweep and reappear when it settles).
// ----------------------------------------------------------------------
export class LonLatBroadPhase
{
    #planet;
    #capModel;
    #traverseAxis;
    #cutStrategy;

    #slab = false;
    #meridianPhase = false;
    #greatCirclePhase = false;
    #cols = null;
    #candRows = null;
    #n = null;
    #k = 0;

    constructor(planet, capModel, traverseAxis, cutStrategy)
    {
        this.#planet = planet;
        this.#capModel = capModel;
        this.#traverseAxis = traverseAxis;
        this.#cutStrategy = cutStrategy;
    }

    prepare(plane, focus, slab)
    {
        this.#slab = slab;
        this.#n = plane.normal;
        this.#k = plane.constant;

        const latitudeAxis = this.#traverseAxis === 'latitude';
        const pole = this.#cutStrategy.isPoleCut(focus);

        this.#meridianPhase = !slab && (!latitudeAxis || pole);
        this.#greatCirclePhase = !slab && latitudeAxis && !pole;
        this.#cols = this.#meridianPhase ? this.#cutColumns(focus.lon) : null;
        this.#candRows = this.#greatCirclePhase ? this.#latitudeCrossingRows(focus) : null;
    }

    accept(cell)
    {
        if (this.#slab)
        {
            if (cell.kind === 'cap') return false;

            cellBounds(cell);

            return Math.abs(this.#n.x * cell._cx + this.#n.y * cell._cy + this.#n.z * cell._cz + this.#k) <= cell._cr;
        }

        if (cell.kind === 'cap')
        {
            return this.#meridianPhase;
        }

        if (this.#greatCirclePhase)
        {
            return cell.latIdx >= this.#candRows.lo[cell.lonIdx] - 1
                && cell.latIdx <= this.#candRows.hi[cell.lonIdx] + 1;
        }

        return this.#cols.has(cell.lonIdx);
    }

    // Which longitude columns can the meridian plane cut? The meridian
    // through `focusLon` crosses the body at that longitude AND its antipode.
    #cutColumns(focusLon)
    {
        const w = 360 / this.#planet.lonCells;
        const cols = new Set();
        const eps = 1e-6;

        for (const base of [focusLon, focusLon + 180])
        {
            const norm = ((base % 360) + 360) % 360;
            cols.add(Math.floor((norm - eps + 360) % 360 / w));
            cols.add(Math.floor((norm + eps) % 360 / w));
        }

        return cols;
    }

    // Latitude-axis broad-phase: the tilted great circle crosses each column
    // at one latitude; return the inclusive row span per column.
    #latitudeCrossingRows(focus)
    {
        const lonCells = this.#planet.lonCells;
        const rowDegLat = this.#capModel.rowDegLat;
        const colDeg = 360 / lonCells;
        const tanPhi = Math.tan(deg2rad(focus.lat));
        const lamR = deg2rad(focus.lon);
        const lo = new Int32Array(lonCells);
        const hi = new Int32Array(lonCells);

        const rowAt = lonDeg => {
            const latDeg = Math.atan(tanPhi * Math.cos(lamR - deg2rad(lonDeg))) * 180 / Math.PI;

            return Math.floor((latDeg + 90) / rowDegLat);
        };

        for (let i = 0; i < lonCells; i++)
        {
            const a = rowAt(i * colDeg);
            const b = rowAt((i + 1) * colDeg);
            lo[i] = Math.min(a, b);
            hi[i] = Math.max(a, b);
        }

        return { lo, hi };
    }
}
