import * as THREE from 'three';
import { sphere } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// CentroidIndex — nearest-cell lookup over the Goldberg surface cells by
// centroid DIRECTION. Picking and stroll-snapping both reduce to "which cell
// centre is closest (largest dot product) to this unit direction".
//
// The query runs on EVERY frame the camera moves (view-mode hover picking) and
// on every stroll snap, so at high `hexFrequency` (163k cells at f=128, and it
// grows with f²) the lookup is squarely on the hot path. Rather than chase one
// THREE.Vector3 object per cell (pointer-heavy, cache-hostile), the centroid
// directions are packed once into a contiguous Float32Array and the nearest
// search is a flat, allocation-free, cache-friendly scan over that buffer. The
// result is identical to the old per-object scan; only the memory layout
// changed.
// ----------------------------------------------------------------------
export class CentroidIndex
{
    #cells;
    #dirs;   // Float32Array [x0,y0,z0, x1,y1,z1, …] — one per cell, same order as #cells
    #count;
    #dir = new THREE.Vector3();

    constructor(surfaceCells)
    {
        this.#cells = surfaceCells;
        this.#count = surfaceCells.length;
        this.#dirs = new Float32Array(this.#count * 3);

        for (let i = 0; i < this.#count; i++)
        {
            const c = surfaceCells[i].centroidDir;
            const o = i * 3;
            this.#dirs[o]     = c.x;
            this.#dirs[o + 1] = c.y;
            this.#dirs[o + 2] = c.z;
        }
    }

    nearestToDirection(dir)
    {
        const dirs = this.#dirs;
        const dx = dir.x, dy = dir.y, dz = dir.z;

        let bestIndex = -1;
        let bestDot = -Infinity;

        for (let i = 0, o = 0; i < this.#count; i++, o += 3)
        {
            const dot = dirs[o] * dx + dirs[o + 1] * dy + dirs[o + 2] * dz;

            if (dot > bestDot)
            {
                bestDot = dot;
                bestIndex = i;
            }
        }

        return bestIndex === -1 ? null : this.#cells[bestIndex];
    }

    nearestToLonLat(lonDeg, latDeg)
    {
        return this.nearestToDirection(this.#dir.copy(sphere(lonDeg, latDeg, 1)));
    }
}
