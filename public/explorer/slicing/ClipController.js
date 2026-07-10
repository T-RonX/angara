import * as THREE from 'three';

// ----------------------------------------------------------------------
// ClipController — owns the single plane that slices the body open in
// resource mode. It delegates the plane's ORIENTATION to the topology's cut
// strategy (meridian / tilted / tangent), then places it at `constant`
// (through the body centre except during the open-slice transition) and
// rebuilds the caps. It is otherwise topology-agnostic.
//
// THROTTLING — re-orienting the plane is cheap and happens every call, but
// `sliceBuilder.build()` re-scans every cell and re-uploads changed bucket
// geometry, which is expensive when called on every animation frame during a
// continuous drag. Callers that opt in via `{ throttle: true }` (the
// FocusController's per-frame easing) get the rebuild capped to
// `#rebuildIntervalMs`; the plane itself still updates immediately so the
// camera framing never lags. A deferred rebuild is tracked via
// `#pendingRebuild` and must be flushed with `flush()` once the motion that
// triggered it settles, so the geometry never gets stuck stale.
// ----------------------------------------------------------------------
export class ClipController
{
    plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    worldPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    cutKey = null; // signature of the last applied cut (null = never built)

    onCutChanged = null; // called after the plane / caps update (hover invalidation)

    #focus;
    #cutStrategy;
    #bodyGroup = null;
    #sliceBuilder = null;

    #lastBuildT = -Infinity;
    #rebuildIntervalMs = 55;
    #pendingRebuild = false;

    constructor(focus, cutStrategy, bodyGroup = null, rebuildIntervalMs = 55)
    {
        this.#focus = focus;
        this.#cutStrategy = cutStrategy;
        this.#bodyGroup = bodyGroup ?? null;
        this.#rebuildIntervalMs = rebuildIntervalMs;
    }

    setSliceBuilder(sliceBuilder)
    {
        this.#sliceBuilder = sliceBuilder;
    }

    setBodyGroup(group)
    {
        this.#bodyGroup = group;
    }

    // Re-derive `worldPlane` from `plane` and the body's current world matrix.
    // Call every frame after body transforms are updated (and after updateCut
    // when the local plane changes mid-frame).
    syncWorldPlane()
    {
        if (!this.#bodyGroup) return;

        this.worldPlane.copy(this.plane).applyMatrix4(this.#bodyGroup.matrixWorld);
    }

    resetCut()
    {
        this.cutKey = null;
        this.#pendingRebuild = false;
    }

    // Re-orient and re-place the plane (always), then rebuild the slice —
    // immediately, unless `throttle` is set and a rebuild happened too
    // recently, in which case the rebuild is deferred (`#pendingRebuild`) and
    // must be caught up later via `flush()`. Returns whether a rebuild
    // actually ran. `constant` / `slab` are non-default only during the
    // open-slice transition, which always forces an immediate rebuild.
    updateCut(constant = 0, slab = false, { throttle = false } = {})
    {
        this.#cutStrategy.orient(this.plane, this.#focus);
        this.plane.constant = constant;
        this.syncWorldPlane();

        const now = performance.now();
        const forced = this.cutKey === null || slab || !throttle;

        if (!forced && now - this.#lastBuildT < this.#rebuildIntervalMs)
        {
            this.#pendingRebuild = true;

            return false;
        }

        this.#sliceBuilder.build(slab);
        this.cutKey = `${this.#focus.lon},${this.#focus.lat}`;
        this.#lastBuildT = now;
        this.#pendingRebuild = false;

        if (this.onCutChanged) this.onCutChanged();

        return true;
    }

    // Force any deferred rebuild through immediately — call once the motion
    // that deferred it (e.g. a drag) stops, so the geometry always settles to
    // the exact final cut. Returns whether a rebuild actually ran.
    flush()
    {
        if (!this.#pendingRebuild) return false;

        return this.updateCut(this.plane.constant, false, { throttle: false });
    }
}
