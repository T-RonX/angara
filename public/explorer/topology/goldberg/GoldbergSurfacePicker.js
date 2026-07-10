import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergSurfacePicker -- surface picking for view mode. For a perfect
// sphere the depth-0 surface is a sphere of `bodyRadius`, so a closed-form
// ray-vs-sphere test gives the hit point and the nearest cell centre (via
// CentroidIndex) is the picked cell.
//
// For an irregular (displaced) body there is no closed-form surface, so it
// falls back to raycasting the merged surface mesh and mapping the hit
// triangle back to its cell via the mesh's `faceToCell` table.
// ----------------------------------------------------------------------
export class GoldbergSurfacePicker
{
    #bodyRadius;
    #index;
    #shapeField;
    #surfaceMesh;
    #hit = new THREE.Vector3();
    #bodyGroup = null;
    #localO = new THREE.Vector3();
    #localD = new THREE.Vector3();
    #invBodyMatrix = new THREE.Matrix4();

    constructor(body, centroidIndex, shapeField, surfaceMesh, bodyGroup = null)
    {
        this.#bodyRadius = body.radius;
        this.#index = centroidIndex;
        this.#shapeField = shapeField;
        this.#surfaceMesh = surfaceMesh ?? null;
        this.#bodyGroup = bodyGroup ?? null;

        // Displaced bodies fall back to raycasting the merged surface mesh; a
        // BVH keeps that O(log n) instead of scanning every surface triangle.
        const geo = this.#surfaceMesh?.geometry;

        // `indirect: true` keeps the geometry index (and reported faceIndex)
        // in original order — required so faceToCell mapping stays correct.
        if (geo && geo.computeBoundsTree && !geo.boundsTree) geo.computeBoundsTree({ indirect: true });
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
    // Transforms the ray into body-local space when a body group is available,
    // so the sphere test and CentroidIndex lookup stay in body-local coordinates
    // regardless of body position or rotation.
    #pickSphere(raycaster)
    {
        let o = raycaster.ray.origin;
        let d = raycaster.ray.direction;
        const R = this.#bodyRadius;

        // Transform the world-space ray to body-local space.
        if (this.#bodyGroup)
        {
            this.#invBodyMatrix.copy(this.#bodyGroup.matrixWorld).invert();
            this.#localO.copy(o).applyMatrix4(this.#invBodyMatrix);
            this.#localD.copy(d).transformDirection(this.#invBodyMatrix);
            o = this.#localO;
            d = this.#localD;
        }

        // Solve |o + t·d|² = R²  (d is unit length in local space).
        const b = o.dot(d);
        const c = o.dot(o) - R * R;
        const disc = b * b - c;

        if (disc < 0) return null;

        const sq = Math.sqrt(disc);
        let t = -b - sq;
        if (t < 0) t = -b + sq;
        if (t < 0) return null;

        // Hit direction is in body-local space — correct for CentroidIndex.
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
