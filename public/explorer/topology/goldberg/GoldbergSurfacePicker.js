import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergSurfacePicker — surface picking for view mode. For a perfect sphere
// the depth-0 surface is a sphere of `planetRadius`, so a closed-form
// ray-vs-sphere test gives the hit point and the nearest cell centre (via
// CentroidIndex) is the picked cell — fast and exact.
//
// For an irregular (displaced) body there is no closed-form surface, so it
// falls back to raycasting the merged surface mesh and mapping the hit triangle
// back to its cell via the mesh's `faceToCell` table.
// ----------------------------------------------------------------------
export class GoldbergSurfacePicker
{
    #planetRadius;
    #index;
    #shapeField;
    #surfaceMesh;
    #hit = new THREE.Vector3();

    constructor(planet, centroidIndex, shapeField, surfaceMesh)
    {
        this.#planetRadius = planet.radius;
        this.#index = centroidIndex;
        this.#shapeField = shapeField;
        this.#surfaceMesh = surfaceMesh ?? null;
    }

    pick(raycaster)
    {
        if (this.#shapeField && !this.#shapeField.isSphere)
        {
            return this.#pickMesh(raycaster);
        }

        return this.#pickSphere(raycaster);
    }

    // Analytical ray-vs-sphere (perfect-sphere fast path).
    #pickSphere(raycaster)
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

    // Raycast the merged surface mesh and map the hit face back to its cell.
    #pickMesh(raycaster)
    {
        if (!this.#surfaceMesh) return null;

        const hit = raycaster.intersectObject(this.#surfaceMesh, false)[0];

        if (!hit) return null;

        const faceToCell = hit.object.userData.faceToCell;

        return faceToCell ? (faceToCell[hit.faceIndex] ?? null) : null;
    }
}
