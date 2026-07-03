// ----------------------------------------------------------------------
// InputController — translates pointer / wheel / keyboard input into focus
// targets, zoom and clicks while in resource mode. Drag strolls the crust,
// the wheel zooms, arrow keys step one cell at a time, and a click selects
// the hovered cell. View-mode orbit/zoom stays with OrbitControls.
//
// It only ever sets TARGETS via the topology's traversal strategy — the
// FocusController eases the visible focus toward them — so the motion feels
// analog while dragging and snaps cleanly on release. The traversal owns
// every topology-specific stepping rule.
// ----------------------------------------------------------------------
export class InputController
{
    #sceneContext;
    #state;
    #planet;
    #layerModel;
    #traversal;
    #cameraCfg;
    #crustCamera;
    #highlights;
    #callbacks;

    #drag = { active: false, x: 0, y: 0 };
    #pressOrigin = { x: 0, y: 0, valid: false };

    static CLICK_SLOP_PX = 4;

    constructor(sceneContext, state, behaviour, planet, layerModel, traversal, crustCamera, highlightManager, callbacks)
    {
        this.#sceneContext = sceneContext;
        this.#state = state;
        this.#planet = planet;
        this.#layerModel = layerModel;
        this.#traversal = traversal;
        this.#cameraCfg = behaviour.camera;
        this.#crustCamera = crustCamera;
        this.#highlights = highlightManager;
        this.#callbacks = callbacks;

        this.#bind();
    }

    #bind()
    {
        const el = this.#sceneContext.domElement;

        el.addEventListener('pointerdown', e => this.#onStrollStart(e));
        window.addEventListener('pointerup', () => this.#onStrollEnd());
        window.addEventListener('pointermove', e => this.#onStrollMove(e));
        el.addEventListener('wheel', e => this.#onWheel(e), { passive: false });
        window.addEventListener('keydown', e => this.#onKeyDown(e));

        // Click selection (distinguished from drag via a slop threshold).
        el.addEventListener('pointerdown', e => {
            this.#pressOrigin.x = e.clientX;
            this.#pressOrigin.y = e.clientY;
            this.#pressOrigin.valid = true;
        });
        el.addEventListener('click', e => this.#onClick(e));
    }

    #busy()
    {
        return this.#state.mode !== 'resource' || this.#state.transition.active;
    }

    #onStrollStart(e)
    {
        if (this.#busy()) return;

        this.#drag.active = true;
        this.#drag.x = e.clientX;
        this.#drag.y = e.clientY;
    }

    #onStrollEnd()
    {
        if (!this.#drag.active) return;

        this.#drag.active = false;

        if (this.#state.mode === 'resource')
        {
            this.#traversal.snapTargets(this.#state.focus);
        }
    }

    #onStrollMove(e)
    {
        if (!this.#drag.active || this.#busy()) return;

        const dx = e.clientX - this.#drag.x;
        const dy = e.clientY - this.#drag.y;
        this.#drag.x = e.clientX;
        this.#drag.y = e.clientY;

        const dpp = this.#crustCamera.dragDegPerPixel();
        this.#traversal.onDrag(this.#state.focus, dx, dy, dpp);
    }

    #onWheel(e)
    {
        if (this.#busy()) return; // OrbitControls zooms in view mode

        e.preventDefault();

        const thickness = this.#planet.radius - this.#layerModel.coreRadius;
        const min = thickness * this.#cameraCfg.crustZoomMin;
        const max = thickness * this.#cameraCfg.crustZoomMax;
        this.#state.camDist = Math.max(min, Math.min(max,
            this.#state.camDist * (e.deltaY > 0 ? 1.1 : 0.9)));
        this.#crustCamera.positionCrustCamera();
    }

    #onKeyDown(e)
    {
        const k = e.key.toLowerCase();

        if (k === 'r')
        {
            this.#callbacks.toggleMode();

            return;
        }

        if (this.#busy()) return;

        this.#traversal.onArrow(this.#state.focus, e.key);
    }

    #onClick(e)
    {
        if (this.#state.transition.active) return;   // ignore picks mid-flight
        if (!this.#highlights.highlight.visible) return;

        // Reject the synthetic click that fires at the end of a drag.
        if (this.#pressOrigin.valid)
        {
            const moved = Math.hypot(e.clientX - this.#pressOrigin.x, e.clientY - this.#pressOrigin.y);
            this.#pressOrigin.valid = false;

            if (moved > InputController.CLICK_SLOP_PX) return;
        }

        const cell = this.#highlights.hoveredCell;

        if (!cell) return;

        if (this.#state.mode === 'view')
        {
            if (cell.depth !== 0) return; // only surface cells anchor resource mode

            this.#callbacks.selectSurfaceCell(cell);

            return;
        }

        this.#callbacks.selectResourceCell(cell);
    }
}
