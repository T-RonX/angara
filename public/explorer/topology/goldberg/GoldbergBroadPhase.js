import { cellBounds } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// GoldbergBroadPhase — narrows which cells the cut can cross. The hexsphere
// has no regular lon/lat index to exploit, so it uses the generalised
// bounding-sphere-vs-plane test for every case (through-centre meridian cut
// AND the off-centre open-slice sweep during the mode transition). A cell is
// accepted when the plane passes within its cached bounding radius:
//
//   |n·centre + k| ≤ radius
//
// `cellBounds` caches each cell's sphere once, so this is a cheap dot product
// per cell thereafter.
// ----------------------------------------------------------------------
export class GoldbergBroadPhase
{
    #n = null;
    #k = 0;

    prepare(plane)
    {
        this.#n = plane.normal;
        this.#k = plane.constant;
    }

    accept(cell)
    {
        cellBounds(cell);

        return Math.abs(this.#n.x * cell._cx + this.#n.y * cell._cy + this.#n.z * cell._cz + this.#k) <= cell._cr;
    }
}
