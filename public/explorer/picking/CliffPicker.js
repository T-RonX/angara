// ----------------------------------------------------------------------
// CliffPicker — resource-mode picking. The cut caps carry arbitrary
// cross-section geometry that isn't a sphere, so there's no closed-form
// shortcut: raycast the (few) merged cap meshes and map the hit triangle
// back to its cell via the faceToCell table.
// ----------------------------------------------------------------------
export class CliffPicker
{
    #sliceBuilder;

    constructor(sliceBuilder)
    {
        this.#sliceBuilder = sliceBuilder;
    }

    pick(raycaster)
    {
        const hit = raycaster.intersectObjects(this.#sliceBuilder.capMeshes, false)[0];

        if (!hit || !hit.object.userData.faceToCell)
        {
            return null;
        }

        return hit.object.userData.faceToCell[hit.faceIndex] ?? null;
    }
}
