import * as THREE from 'three';
import { sphere } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// CentroidIndex — nearest-cell lookup over the Goldberg surface cells by
// centroid DIRECTION. Picking and stroll-snapping both reduce to "which cell
// centre is closest (largest dot product) to this unit direction". The cell
// count is modest (10·f²+2), so a linear scan of unit-vector dot products is
// comfortably sub-millisecond and keeps the code simple and exact.
// ----------------------------------------------------------------------
export class CentroidIndex
{
    #cells;
    #dir = new THREE.Vector3();

    constructor(surfaceCells)
    {
        this.#cells = surfaceCells;
    }

    nearestToDirection(dir)
    {
        let best = null;
        let bestDot = -Infinity;

        for (const cell of this.#cells)
        {
            const c = cell.centroidDir;
            const dot = c.x * dir.x + c.y * dir.y + c.z * dir.z;

            if (dot > bestDot)
            {
                bestDot = dot;
                best = cell;
            }
        }

        return best;
    }

    nearestToLonLat(lonDeg, latDeg)
    {
        return this.nearestToDirection(this.#dir.copy(sphere(lonDeg, latDeg, 1)));
    }
}
