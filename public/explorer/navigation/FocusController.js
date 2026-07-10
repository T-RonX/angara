// ----------------------------------------------------------------------
// FocusController -- owns the "focus point" the crust view is centred on and
// eases it toward its target every frame. The topology-specific rules for
// WHICH axis moves the cut live in the injected traversal strategy; this
// class is the generic easing + the "when the focus moves, drive the cut /
// camera / read-out" glue.
// For displaced bodies, the plane offset (-maxRadius) is maintained across
// focus moves so geometry is never clipped.
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

    // Delegate easing to the traversal's pole-free frame and rebuild the
    // cut/camera when anything moved.
    easeFocusToTarget()
    {
        const focus = this.#state.focus;
        const r = this.#traversal.advance(focus, this.#snapEase);

        this.#state.resourceMoving = r.moved;

        if (r.moved) this.#updateResource(r.cutChanged, true);
        else this.#settle();

        this.#wasMoving = r.moved;
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
