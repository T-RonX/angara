import * as THREE from 'three';
import { easeInOut } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// ModeTransition — the smooth fly-in / fly-out between view and resource
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
    #bodyMesh;
    #capBuilder;
    #highlights;
    #hud;
    #planet;
    #durationMs;

    #target = new THREE.Vector3();

    constructor(state, sceneContext, clipController, crustCamera, bodyMesh, capBuilder, highlightManager, hud, planet, behaviour)
    {
        this.#state = state;
        this.#sceneContext = sceneContext;
        this.#clip = clipController;
        this.#crustCamera = crustCamera;
        this.#bodyMesh = bodyMesh;
        this.#capBuilder = capBuilder;
        this.#highlights = highlightManager;
        this.#hud = hud;
        this.#planet = planet;
        this.#durationMs = behaviour.transition.modeTransitionMs;
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

        // Sweep the cut open: constant planetRadius (whole body) → 0 (centre).
        this.#clip.updateCut(this.#planet.radius * (1 - e), true);

        if (tr.dir > 0 && tr.s >= 1)      this.#finish('resource');
        else if (tr.dir < 0 && tr.s <= 0) this.#finish('view');
    }

    #finish(mode)
    {
        this.#state.transition.active = false;
        this.#state.transition.dir = 0;

        if (mode === 'resource')
        {
            // Settle on the exact through-centre cut (the precise broad-phase
            // includes polar caps, which the sweep skipped).
            this.#clip.updateCut(0, false);
            this.#highlights.rebuildResourceSelection();
            this.#crustCamera.positionCrustCamera();
            this.#hud.updateFocusReadout(this.#state.focus);
        }
        else
        {
            this.#bodyMesh.applyClipping(false, this.#clip.plane);
            this.#capBuilder.clearCaps();

            const controls = this.#sceneContext.controls;
            const camera = this.#sceneContext.camera;

            if (this.#state.viewSnapshot)
            {
                camera.position.copy(this.#state.viewSnapshot.position);
                camera.up.copy(this.#state.viewSnapshot.up);
                controls.target.copy(this.#state.viewSnapshot.target);
            }
            else
            {
                controls.target.set(0, 0, 0);
            }

            controls.enabled = true;
            controls.update();
        }
    }
}

