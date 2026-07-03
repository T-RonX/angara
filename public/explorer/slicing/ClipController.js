import * as THREE from 'three';

// ----------------------------------------------------------------------
// ClipController — owns the single plane that slices the body open in
// resource mode. It delegates the plane's ORIENTATION to the topology's cut
// strategy (meridian / tilted / tangent), then places it at `constant`
// (through the body centre except during the open-slice transition) and
// rebuilds the caps. It is otherwise topology-agnostic.
// ----------------------------------------------------------------------
export class ClipController
{
    plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    cutKey = null; // signature of the last applied cut (null = never built)

    onCutChanged = null; // called after the plane / caps update (hover invalidation)

    #focus;
    #cutStrategy;
    #capBuilder = null;

    constructor(focus, cutStrategy)
    {
        this.#focus = focus;
        this.#cutStrategy = cutStrategy;
    }

    setCapBuilder(capBuilder)
    {
        this.#capBuilder = capBuilder;
    }

    resetCut()
    {
        this.cutKey = null;
    }

    // Re-orient and re-place the plane, then rebuild the caps. `constant` /
    // `slab` are non-default only during the open-slice transition.
    updateCut(constant = 0, slab = false)
    {
        this.#cutStrategy.orient(this.plane, this.#focus);
        this.plane.constant = constant;
        this.#capBuilder.build(slab);
        this.cutKey = `${this.#focus.lon},${this.#focus.lat}`;

        if (this.onCutChanged) this.onCutChanged();
    }
}
