// ----------------------------------------------------------------------
// FocusController — owns the "focus point" the crust view is centred on and
// eases it toward its target every frame (the same damped feel as releasing
// an OrbitControls orbit). The topology-specific rules for WHICH axis moves
// the cut live in the injected traversal strategy; this class is just the
// generic easing + the "when the focus moves, drive the cut / camera /
// read-out" glue.
// ----------------------------------------------------------------------
export class FocusController
{
    #state;
    #traversal;
    #snapEase;
    #clip;
    #crustCamera;
    #highlights;
    #hud;
    #wasMoving = false;

    constructor(state, traversal, behaviour, clipController, crustCamera, highlightManager, hud)
    {
        this.#state = state;
        this.#traversal = traversal;
        this.#snapEase = behaviour.input.focusSnapEase;
        this.#clip = clipController;
        this.#crustCamera = crustCamera;
        this.#highlights = highlightManager;
        this.#hud = hud;
    }

    // Glide focus.{lon,lat} toward their targets; rebuild the cut/camera when
    // anything moved. Longitude eases along the shortest arc across 0/360.
    easeFocusToTarget()
    {
        const focus = this.#state.focus;

        // Topology hook: if the traversal owns its own eased frame (the
        // hexsphere's pole-free direction/normal frame), delegate to it and
        // keep the lon/lat easing below strictly for the lon/lat topology.
        if (typeof this.#traversal.advance === 'function')
        {
            const r = this.#traversal.advance(focus, this.#snapEase);
            this.#state.resourceMoving = r.moved;

            if (r.moved) this.#updateResource(r.cutChanged, true);
            else this.#settle();

            this.#wasMoving = r.moved;

            return;
        }

        const EPS = 1e-3;
        let lonChanged = false;
        let latChanged = false;
        let moved = false;

        let dLon = focus.lonTarget - focus.lon;
        if (dLon > 180)  dLon -= 360;
        if (dLon < -180) dLon += 360;

        if (Math.abs(dLon) > EPS)
        {
            focus.lon = (focus.lon + dLon * this.#snapEase + 360) % 360;
            lonChanged = true;
            moved = true;
        }
        else if (focus.lon !== focus.lonTarget)
        {
            focus.lon = focus.lonTarget;
            lonChanged = true;
            moved = true;
        }

        const dLat = focus.latTarget - focus.lat;

        if (Math.abs(dLat) > EPS)
        {
            focus.lat += dLat * this.#snapEase;
            latChanged = true;
            moved = true;
        }
        else if (focus.lat !== focus.latTarget)
        {
            focus.lat = focus.latTarget;
            latChanged = true;
            moved = true;
        }

        this.#state.resourceMoving = moved;

        if (moved) this.#updateResource(this.#traversal.cutMoved(lonChanged, latChanged), true);
        else this.#settle();

        this.#wasMoving = moved;
    }

    // Rebuild the cut (only when it actually moved), re-aim the crust camera
    // and refresh the focus read-out. `throttle` caps the expensive geometry
    // rebuild to a fixed rate while continuously moving; the plane/camera
    // itself still updates every frame so aiming never lags.
    #updateResource(cutChanged, throttle = false)
    {
        if (cutChanged || this.#clip.cutKey === null)
        {
            const built = this.#clip.updateCut(0, false, { throttle });

            if (built) this.#highlights.rebuildResourceSelection();
        }

        this.#crustCamera.positionCrustCamera();
        this.#hud.updateFocusReadout(this.#state.focus);
    }

    // Catch up any rebuild deferred by throttling once motion stops, so the
    // geometry always settles to the exact final cut with no stale state.
    #settle()
    {
        if (!this.#wasMoving) return;

        if (this.#clip.flush()) this.#highlights.rebuildResourceSelection();
    }
}
