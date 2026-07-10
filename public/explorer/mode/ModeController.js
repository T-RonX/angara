import * as THREE from 'three';

// ----------------------------------------------------------------------
// ModeController — explicit view / resource / transition mode behaviour.
//
// Each mode is a distinct branch — no optional topology checks, no typeof
// dispatch. The controller manages the transition state machine, and
// delegates body-specific enter/exit side-effects to the owner via the
// `onChanged` callback:
//   onChanged(mode, action)  action ∈ { 'enter', 'exit', 'reverse' }
//
// The per-frame camera routing (view → controls.update, resource → focus
// easing + crust camera, transition → ModeTransition.step) lives in
// updateCamera() so the frame loop is a single call.
// ----------------------------------------------------------------------
export class ModeController
{
    #state;
    #sceneContext;
    #onChanged;

    constructor(state, sceneContext, onChanged)
    {
        this.#state = state;
        this.#sceneContext = sceneContext;
        this.#onChanged = onChanged;
    }

    get mode() { return this.#state.mode; }

    toggle()
    {
        this.setMode(this.#state.mode === 'view' ? 'resource' : 'view');
    }

    setMode(mode)
    {
        const state = this.#state;

        if (mode === 'resource' && state.selected === null) return;
        if (state.mode === mode && !state.transition.active) return;

        const resource = mode === 'resource';
        state.mode = mode;

        // Shared bookkeeping (start AND mid-flight reversal).
        this.#sceneContext.controls.enabled = false;
        state.resourceSelected = null;

        // Mid-flight toggle: reverse direction, no new enter/exit hooks.
        if (state.transition.active)
        {
            state.transition.dir = resource ? 1 : -1;
            this.#onChanged(mode, 'reverse');

            return;
        }

        if (resource)
        {
            this.#beginEnter();
            this.#onChanged(mode, 'enter');
        }
        else
        {
            this.#beginExit();
            this.#onChanged(mode, 'exit');
        }
    }

    // Start a view → resource transition.
    #beginEnter()
    {
        const state = this.#state;
        const camera = this.#sceneContext.camera;

        const orbit = {
            position: camera.position.clone(),
            up: camera.up.clone(),
            target: this.#sceneContext.controls.target.clone(),
        };
        state.viewSnapshot = orbit;
        state.transition.orbit = orbit;
        state.transition.s = 0;
        state.transition.dir = 1;
        state.transition.active = true;
    }

    // Start a resource → view transition.
    #beginExit()
    {
        const state = this.#state;
        const camera = this.#sceneContext.camera;

        if (!state.transition.orbit)
        {
            state.transition.orbit = state.viewSnapshot ?? {
                position: camera.position.clone(),
                up: camera.up.clone(),
                target: new THREE.Vector3(),
            };
        }

        state.transition.s = 1;
        state.transition.dir = -1;
        state.transition.active = true;
    }

    // Per-frame camera routing — explicit per-mode, no typeof dispatch.
    updateCamera(session, dt)
    {
        const state = this.#state;

        if (state.transition.active)
        {
            session.stepTransition(dt);

            return;
        }

        if (state.mode === 'view')
        {
            this.#sceneContext.controls.update();

            return;
        }

        // Resource mode: ease the focus and frame the crust camera.
        session.easeFocus();
        session.positionCamera();
    }
}
