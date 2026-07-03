import * as THREE from 'three';
import { RAD2DEG } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// SurfacePicker — O(1) analytical surface picking for view mode. The
// depth-0 mesh is a sphere of `planetRadius` centred at the origin, so a
// closed-form ray-vs-sphere test plus a grid index beats brute-forcing the
// ~125k surface triangles (the FPS sink when hovering the body).
// ----------------------------------------------------------------------
export class SurfacePicker
{
    #planetRadius;
    #rowDegLat;
    #capRows;
    #lonCells;
    #latCells;
    #grid;
    #hit = new THREE.Vector3();

    constructor(planet, capModel, cellGrid)
    {
        this.#planetRadius = planet.radius;
        this.#lonCells = planet.lonCells;
        this.#latCells = planet.latCells;
        this.#rowDegLat = capModel.rowDegLat;
        this.#capRows = capModel.capRows;
        this.#grid = cellGrid;
    }

    pick(raycaster)
    {
        const o = raycaster.ray.origin;
        const d = raycaster.ray.direction;
        const R = this.#planetRadius;

        // Solve |o + t·d|² = R²  (d is unit length).
        const b = o.dot(d);
        const c = o.dot(o) - R * R;
        const disc = b * b - c;

        if (disc < 0) return null;

        const sq = Math.sqrt(disc);
        let t = -b - sq;
        if (t < 0) t = -b + sq;
        if (t < 0) return null;

        this.#hit.copy(d).multiplyScalar(t).add(o);

        const latDeg = Math.asin(THREE.MathUtils.clamp(this.#hit.y / R, -1, 1)) * RAD2DEG;
        let lonDeg = Math.atan2(this.#hit.z, this.#hit.x) * RAD2DEG;
        if (lonDeg < 0) lonDeg += 360;

        const j = Math.floor((latDeg + 90) / this.#rowDegLat);

        if (j < this.#capRows)                    return this.#grid.surfaceCapSouth;
        if (j >= this.#latCells - this.#capRows)  return this.#grid.surfaceCapNorth;

        let i = Math.floor(lonDeg / 360 * this.#lonCells);
        if (i < 0)               i = 0;
        if (i >= this.#lonCells) i = this.#lonCells - 1;

        return this.#grid.surfaceQuadLookup[j * this.#lonCells + i];
    }
}

