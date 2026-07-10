import * as THREE from 'three';
import { easeInOut } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// ModeTransition -- the smooth fly-in / fly-out between view and resource
// mode. It eases the camera between the orbit pose and the crust-cliff pose
// while sweeping the clip plane from fully off-centre (whole body) to
// through the centre (the open slice). A mid-flight mode toggle just flips
// the direction so it glides back. All gameplay input is locked while it
// runs.
// ----------------------------------------------------------------------
export class ModeTransition
{
    #state;
    #sceneContext;
    #clip;
    #crustCamera;
    #sliceBuilder;
    #durationMs;
    #sliceStartRadius;

    // Injected completion callbacks; invoked when the transition settles
    // into 'resource' or 'view'. Allows the caller (BodyInteractionSession)
    // to own the HUD/highlight updates without ModeTransition depending on
    // their exact shape.
    #onCompleteResource;
    #onCompleteView;

    #target = new THREE.Vector3();

    constructor(state, sceneContext, clipController, crustCamera, sliceBuilder, transitionConfig, sliceStartRadius, { onCompleteResource, onCompleteView })
    {
        this.#state = state;
        this.#sceneContext = sceneContext;
        this.#clip = clipController;
        this.#crustCamera = crustCamera;
        this.#sliceBuilder = sliceBuilder;
        this.#durationMs = transitionConfig.modeTransitionMs;
        this.#sliceStartRadius = sliceStartRadius;
        this.#onCompleteResource = onCompleteResource;
        this.#onCompleteView = onCompleteView;
    }

    step(dt)
    {
        const tr = this.#state.transition;
        const dur = Math.max(1, this.#durationMs) / 1000;

        tr.s = Math.max(0, Math.min(1, tr.s + tr.dir * dt / dur));

        const e = easeInOut(tr.s);
        const crust = this.#crustCamera.computeCrustPose();
        const camera = this.#sceneContext.camera;

        camera.position.lerpVectors(tr.orbit.position, crust.position, e);
        camera.up.copy(tr.orbit.up).lerp(crust.up, e).normalize();
        this.#target.lerpVectors(tr.orbit.target, crust.target, e);
        camera.lookAt(this.#target);

        // Sweep the cut open: constant maxRadius (whole body) -> 0 (centre).
        this.#clip.updateCut(this.#sliceStartRadius * (1 - e), true);

        if (tr.dir > 0 && tr.s >= 1)      this.#finish('resource');
        else if (tr.dir < 0 && tr.s <= 0) this.#finish('view');
    }

    #finish(mode)
    {
        this.#state.transition.active = false;
        this.#state.transition.dir = 0;

        if (mode === 'resource')
        {
            // Settle on the exact through-centre cut.
            this.#clip.updateCut(0, false);

            this.#onCompleteResource();
        }
        else
        {
            this.#sliceBuilder.exit();

            this.#onCompleteView();
        }
    }
}
