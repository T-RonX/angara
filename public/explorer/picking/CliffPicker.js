// ----------------------------------------------------------------------
// CliffPicker — resource-mode picking. The cut caps carry arbitrary
// cross-section geometry that isn't a sphere, so there's no closed-form
// shortcut: raycast the (few) merged cap meshes and map the hit triangle
// back to its cell via the faceToCell table.
//
// The solid core sphere sits in front of some cap geometry from the crust
// camera's point of view (cells whose cap face is farther along the ray than
// the core's own surface), so the core mesh is raycast alongside the caps and
// any cap hit behind it is rejected — otherwise cells hidden behind the core
// would still be selectable/hoverable.
// ----------------------------------------------------------------------
export class CliffPicker
{
    #sliceBuilder;
    #coreMesh;

    constructor(sliceBuilder, coreMesh)
    {
        this.#sliceBuilder = sliceBuilder;
        this.#coreMesh = coreMesh;

        // The core sphere is raycast every pointer-move frame for occlusion
        // rejection; give it a BVH too so that test is O(log n) rather than a
        // brute-force scan over the full sphere's triangles.
        const geo = coreMesh?.geometry;

        // `indirect: true` keeps the geometry index (and reported faceIndex)
        // in original order — required so faceToCell mapping stays correct.
        if (geo && geo.computeBoundsTree && !geo.boundsTree) geo.computeBoundsTree({ indirect: true });
    }

    pick(raycaster)
    {
        const hit = raycaster.intersectObjects(this.#sliceBuilder.capMeshes, false)[0];

        if (!hit || !hit.object.userData.faceToCell)
        {
            return null;
        }

        // Reject cap hits that are occluded by the (always-opaque) core.
        if (this.#coreMesh && this.#coreMesh.visible)
        {
            const coreHit = raycaster.intersectObject(this.#coreMesh, false)[0];

            if (coreHit && coreHit.distance < hit.distance)
            {
                return null;
            }
        }

        return hit.object.userData.faceToCell[hit.faceIndex] ?? null;
    }
}
