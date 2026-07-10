import * as THREE from 'three';

// HoverController -- drives the hover highlight and the "hover lon/lat/depth"
// read-out. It reads pointer state from a shared pointerSource (InputBinding)
// and once per frame (skipping frames where nothing changed) picks the cell
// under the cursor and asks the HighlightManager to show it and the HUD to
// label it.
//
// View mode uses the analytical SurfacePicker; resource mode raycasts the
// cut caps via the CliffPicker.
export class HoverController
{
    #sceneContext;
    #state;
    #surfacePicker;
    #cliffPicker;
    #highlights;
    #hud;
    #bodyGroup = null;
    #pointerSource;

    #raycaster = new THREE.Raycaster();
    #lastHoverCell = null;
    #lastHoverMode = null;
    #disposed = false;

    // Cache so we can skip the work on frames where neither the cursor nor
    // the camera moved (very common).
    #cache = {
        pointerX: NaN, pointerY: NaN,
        camX: NaN, camY: NaN, camZ: NaN,
        camQx: NaN, camQy: NaN, camQz: NaN, camQw: NaN,
        inside: false, mode: null,
        bodyQx: NaN, bodyQy: NaN, bodyQz: NaN, bodyQw: NaN,
    };

    constructor(sceneContext, state, surfacePicker, cliffPicker, highlightManager, hud, bodyGroup = null, pointerSource = null)
    {
        this.#sceneContext = sceneContext;
        this.#state = state;
        this.#surfacePicker = surfacePicker;
        this.#cliffPicker = cliffPicker;
        this.#highlights = highlightManager;
        this.#hud = hud;
        this.#bodyGroup = bodyGroup ?? null;
        this.#pointerSource = pointerSource;
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

        const pointer = this.#pointerSource?.pointer;
        const inside = this.#pointerSource ? this.#pointerSource.pointerInside : false;

        if (!inside)
        {
            if (this.#lastHoverCell !== null)
            {
                this.#highlights.hideHover();
                this.#hud.clearHoverReadout();
                this.#lastHoverCell = null;
                this.#lastHoverMode = null;
            }

            return;
        }

        this.#raycaster.setFromCamera(pointer, camera);

        const cell = this.#state.mode === 'resource'
            ? this.#cliffPicker.pick(this.#raycaster)
            : this.#surfacePicker.pick(this.#raycaster);

        if (!cell)
        {
            if (this.#lastHoverCell !== null)
            {
                this.#highlights.hideHover();
                this.#hud.clearHoverReadout();
                this.#lastHoverCell = null;
                this.#lastHoverMode = null;
            }

            return;
        }

        if (this.#lastHoverCell === cell && this.#lastHoverMode === this.#state.mode
            && (this.#state.mode !== 'resource' || this.#highlights.resourceHoverIsStatic))
        {
            return;
        }

        this.#highlights.showHover(cell, this.#state.mode);
        this.#hud.setHoverReadout(cell);
        this.#lastHoverCell = cell;
        this.#lastHoverMode = this.#state.mode;
    }

    #cacheStillValid(camPos, camQ)
    {
        const c = this.#cache;
        const bodyQ = this.#bodyGroup?.quaternion;
        const pointer = this.#pointerSource?.pointer;
        const inside = this.#pointerSource ? this.#pointerSource.pointerInside : false;

        return c.inside === inside &&
            c.mode === this.#state.mode &&
            pointer && c.pointerX === pointer.x && c.pointerY === pointer.y &&
            c.camX === camPos.x && c.camY === camPos.y && c.camZ === camPos.z &&
            c.camQx === camQ.x && c.camQy === camQ.y &&
            c.camQz === camQ.z && c.camQw === camQ.w &&
            (!bodyQ || (c.bodyQx === bodyQ.x && c.bodyQy === bodyQ.y &&
                c.bodyQz === bodyQ.z && c.bodyQw === bodyQ.w));
    }

    #refreshCache(camPos, camQ)
    {
        const c = this.#cache;
        const pointer = this.#pointerSource?.pointer;
        c.inside = this.#pointerSource ? this.#pointerSource.pointerInside : false;
        c.mode = this.#state.mode;
        c.pointerX = pointer ? pointer.x : NaN;
        c.pointerY = pointer ? pointer.y : NaN;
        c.camX = camPos.x; c.camY = camPos.y; c.camZ = camPos.z;
        c.camQx = camQ.x; c.camQy = camQ.y; c.camQz = camQ.z; c.camQw = camQ.w;

        if (this.#bodyGroup)
        {
            const bq = this.#bodyGroup.quaternion;
            c.bodyQx = bq.x; c.bodyQy = bq.y; c.bodyQz = bq.z; c.bodyQw = bq.w;
        }
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        // No DOM listeners to remove — InputBinding owns them.
    }
}