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
    #clipPlane;
    #visibleCapMeshes = [];
    #capHits = [];
    #coreHits = [];

    constructor(sliceBuilder, coreMesh, clipPlane)
    {
        this.#sliceBuilder = sliceBuilder;
        this.#coreMesh = coreMesh;
        this.#clipPlane = clipPlane;

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
        if (this.#sliceBuilder.ensureAtmosphere) this.#sliceBuilder.ensureAtmosphere();

        this.#collectVisibleCapMeshes();
        this.#ensureBoundsTrees();

        this.#capHits.length = 0;
        raycaster.intersectObjects(this.#visibleCapMeshes, false, this.#capHits);
        const hit = this.#capHits[0];
        this.#capHits.length = 0;
        this.#visibleCapMeshes.length = 0;

        if (!hit || !hit.object.userData.faceToCell)
        {
            return null;
        }

        // Reject cap hits that are occluded by the (always-opaque) core.
        if (this.#coreMesh && this.#coreMesh.visible)
        {
            const coreHit = this.#nearestVisibleCoreHit(raycaster);

            if (coreHit && coreHit.distance < hit.distance)
            {
                return null;
            }
        }

        return hit.object.userData.faceToCell[hit.faceIndex] ?? null;
    }

    #collectVisibleCapMeshes()
    {
        this.#visibleCapMeshes.length = 0;

        for (const mesh of this.#sliceBuilder.capMeshes)
        {
            if (mesh.visible) this.#visibleCapMeshes.push(mesh);
        }
    }

    #nearestVisibleCoreHit(raycaster)
    {
        this.#coreHits.length = 0;
        raycaster.intersectObject(this.#coreMesh, false, this.#coreHits);

        let visibleHit = this.#clipPlane ? null : this.#coreHits[0];

        if (this.#clipPlane)
        {
            for (const hit of this.#coreHits)
            {
                // Three.js clips the negative half-space. Raycasting ignores material
                // clipping, so discard intersections the renderer does not draw.
                if (this.#clipPlane.distanceToPoint(hit.point) < -1e-6) continue;

                visibleHit = hit;

                break;
            }
        }

        this.#coreHits.length = 0;

        return visibleHit;
    }

    // Build a BVH on each cap mesh the FIRST time it is about to be raycast.
    // Deferring the build to pick time (rather than mesh-creation time) keeps a
    // cut-advance cheap: picking is skipped while the view moves, so meshes that
    // are created and thrown away mid-advance never pay for a tree. Persistent
    // buckets keep their tree across pans; only freshly rebuilt meshes build.
    // `indirect: true` keeps the geometry index (and faceIndex) in original
    // order so the faceToCell mapping stays correct.
    #ensureBoundsTrees()
    {
        const meshes = this.#visibleCapMeshes;

        for (let i = 0; i < meshes.length; i++)
        {
            const geo = meshes[i].geometry;

            if (geo && geo.computeBoundsTree && !geo.boundsTree) geo.computeBoundsTree({ indirect: true });
        }
    }
}
