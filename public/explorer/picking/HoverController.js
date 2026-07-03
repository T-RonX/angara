import * as THREE from 'three';

// ----------------------------------------------------------------------
// HoverController — drives the hover highlight and the "hover lon/lat/depth"
// read-out. It tracks the pointer, and once per frame (skipping frames where
// nothing relevant changed) it picks the cell under the cursor and asks the
// HighlightManager to show it and the HUD to label it.
//
// View mode uses the analytical SurfacePicker; resource mode raycasts the
// cut caps via the CliffPicker.
// ----------------------------------------------------------------------
export class HoverController
{
    #sceneContext;
    #state;
    #surfacePicker;
    #cliffPicker;
    #highlights;
    #hud;

    #raycaster = new THREE.Raycaster();
    #pointer = new THREE.Vector2();
    #pointerInside = false;

    // Cache so we can skip the work on frames where neither the cursor nor
    // the camera moved (very common).
    #cache = {
        pointerX: NaN, pointerY: NaN,
        camX: NaN, camY: NaN, camZ: NaN,
        camQx: NaN, camQy: NaN, camQz: NaN, camQw: NaN,
        inside: false, mode: null,
    };

    constructor(sceneContext, state, surfacePicker, cliffPicker, highlightManager, hud)
    {
        this.#sceneContext = sceneContext;
        this.#state = state;
        this.#surfacePicker = surfacePicker;
        this.#cliffPicker = cliffPicker;
        this.#highlights = highlightManager;
        this.#hud = hud;

        this.#bindPointer();
    }

    #bindPointer()
    {
        const el = this.#sceneContext.domElement;

        el.addEventListener('pointermove', e => {
            const rect = el.getBoundingClientRect();
            this.#pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.#pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.#pointerInside = true;
        });

        el.addEventListener('pointerleave', () => { this.#pointerInside = false; });
    }

    // Force a re-pick next frame (e.g. after the cut plane moved).
    invalidate()
    {
        this.#cache.pointerX = NaN;
    }

    update()
    {
        if (this.#state.mode === 'resource' && this.#state.resourceMoving)
        {
            return;
        }

        const camera = this.#sceneContext.camera;
        const camPos = camera.position;
        const camQ = camera.quaternion;

        if (this.#cacheStillValid(camPos, camQ))
        {
            return;
        }

        this.#refreshCache(camPos, camQ);

        if (!this.#pointerInside)
        {
            this.#highlights.hideHover();
            this.#hud.clearHoverReadout();

            return;
        }

        this.#raycaster.setFromCamera(this.#pointer, camera);

        const cell = this.#state.mode === 'resource'
            ? this.#cliffPicker.pick(this.#raycaster)
            : this.#surfacePicker.pick(this.#raycaster);

        if (!cell)
        {
            this.#highlights.hideHover();
            this.#hud.clearHoverReadout();

            return;
        }

        this.#highlights.showHover(cell, this.#state.mode);
        this.#hud.setHoverReadout(cell);
    }

    #cacheStillValid(camPos, camQ)
    {
        const c = this.#cache;

        return c.inside === this.#pointerInside &&
            c.mode === this.#state.mode &&
            c.pointerX === this.#pointer.x &&
            c.pointerY === this.#pointer.y &&
            c.camX === camPos.x && c.camY === camPos.y && c.camZ === camPos.z &&
            c.camQx === camQ.x && c.camQy === camQ.y &&
            c.camQz === camQ.z && c.camQw === camQ.w;
    }

    #refreshCache(camPos, camQ)
    {
        const c = this.#cache;
        c.inside = this.#pointerInside;
        c.mode = this.#state.mode;
        c.pointerX = this.#pointer.x;
        c.pointerY = this.#pointer.y;
        c.camX = camPos.x; c.camY = camPos.y; c.camZ = camPos.z;
        c.camQx = camQ.x; c.camQy = camQ.y; c.camQz = camQ.z; c.camQw = camQ.w;
    }
}
