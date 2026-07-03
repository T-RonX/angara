import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergSurfacePicker — O(cells) analytical surface picking for view mode.
// The depth-0 surface is a sphere of `planetRadius`, so a closed-form
// ray-vs-sphere test gives the hit point, and the nearest cell centre (via
// CentroidIndex) is the picked cell. This beats brute-forcing the merged
// surface triangles, exactly like the lon/lat SurfacePicker.
// ----------------------------------------------------------------------
export class GoldbergSurfacePicker
{
    #planetRadius;
    #index;
    #hit = new THREE.Vector3();

    constructor(planet, centroidIndex)
    {
        this.#planetRadius = planet.radius;
        this.#index = centroidIndex;
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

        this.#hit.copy(d).multiplyScalar(t).add(o).normalize();

        return this.#index.nearestToDirection(this.#hit);
    }
}
