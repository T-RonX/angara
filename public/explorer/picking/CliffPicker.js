// ----------------------------------------------------------------------
// CliffPicker — resource-mode picking. The cut caps carry arbitrary
// cross-section geometry that isn't a sphere, so there's no closed-form
// shortcut: raycast the (few) merged cap meshes and map the hit triangle
// back to its cell via the faceToCell table.
// ----------------------------------------------------------------------
export class CliffPicker
{
    #capBuilder;

    constructor(capBuilder)
    {
        this.#capBuilder = capBuilder;
    }

    pick(raycaster)
    {
        const hit = raycaster.intersectObjects(this.#capBuilder.capMeshes, false)[0];

        return hit ? hit.object.userData.faceToCell[hit.faceIndex] : null;
    }
}

