// ----------------------------------------------------------------------
// InputController — translates pointer / wheel / keyboard input into focus
// targets, zoom and clicks while in resource mode. Drag strolls the crust,
// the wheel zooms, arrow keys step one cell at a time, and a click selects
// the hovered cell. View-mode orbit/zoom stays with OrbitControls.
//
// It only ever sets TARGETS — the FocusController eases the visible focus
// toward them — so the motion feels analog while dragging and snaps cleanly
// on release.
// ----------------------------------------------------------------------
export class InputController
{
    #sceneContext;
    #state;
    #planet;
    #capModel;
    #layerModel;
    #latStops;
    #traverseAxis;
    #cameraCfg;
    #focus;          // FocusController (snapping)
    #crustCamera;
    #highlights;
    #callbacks;

    #drag = { active: false, x: 0, y: 0 };
    #pressOrigin = { x: 0, y: 0, valid: false };

    static CLICK_SLOP_PX = 4;

    constructor(sceneContext, state, behaviour, planet, capModel, layerModel, latStops, focusController, crustCamera, highlightManager, callbacks)
    {
        this.#sceneContext = sceneContext;
        this.#state = state;
        this.#planet = planet;
        this.#capModel = capModel;
        this.#layerModel = layerModel;
        this.#latStops = latStops;
        this.#traverseAxis = behaviour.traversal.resourceTraverseAxis;
        this.#cameraCfg = behaviour.camera;
        this.#focus = focusController;
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
            const focus = this.#state.focus;
            focus.lonTarget = this.#focus.snapLonToCol(focus.lonTarget);
            focus.latTarget = this.#focus.snapLatToRow(focus.latTarget);
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
        const focus = this.#state.focus;
        const { capRows, rowDegLat, capCenterLatN, capCenterLatS } = this.#capModel;
        const minLat = -90 + capRows * rowDegLat + rowDegLat / 2;
        const maxLat =  90 - capRows * rowDegLat - rowDegLat / 2;

        if (this.#traverseAxis === 'latitude')
        {
            // Vertical drag travels along latitude (toward the poles, now
            // top/bottom); horizontal pans longitude. The latitude clamp
            // extends onto the polar caps so the pole's view is reachable.
            const latMin = capRows > 0 ? capCenterLatS : minLat;
            const latMax = capRows > 0 ? capCenterLatN : maxLat;
            focus.latTarget = Math.max(latMin, Math.min(latMax, focus.latTarget - dy * dpp.lat));
            focus.lonTarget = (focus.lonTarget + dx * dpp.lon + 360) % 360;
        }
        else
        {
            // Vertical drag travels along longitude (around the equator);
            // horizontal pans latitude along the meridian cliff.
            focus.lonTarget = (focus.lonTarget + dy * dpp.lon + 360) % 360;
            focus.latTarget = Math.max(minLat, Math.min(maxLat, focus.latTarget + dx * dpp.lat));
        }
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

        const focus = this.#state.focus;
        const { capRows, rowDegLat } = this.#capModel;
        const colDeg = 360 / this.#planet.lonCells;

        if (this.#traverseAxis === 'latitude')
        {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
            {
                const dir = e.key === 'ArrowUp' ? 1 : -1;
                const i = capRows > 0
                    ? Math.max(0, Math.min(this.#latStops.length - 1,
                        this.#latStops.nearestIndex(focus.latTarget) + dir))
                    : null;
                focus.latTarget = i !== null
                    ? this.#latStops.at(i)
                    : this.#focus.snapLatToRow(focus.latTarget + dir * rowDegLat);
            }

            if (e.key === 'ArrowLeft')  focus.lonTarget = this.#focus.snapLonToCol(focus.lonTarget - colDeg);
            if (e.key === 'ArrowRight') focus.lonTarget = this.#focus.snapLonToCol(focus.lonTarget + colDeg);
        }
        else
        {
            if (e.key === 'ArrowUp')    focus.lonTarget = this.#focus.snapLonToCol(focus.lonTarget + colDeg);
            if (e.key === 'ArrowDown')  focus.lonTarget = this.#focus.snapLonToCol(focus.lonTarget - colDeg);
            if (e.key === 'ArrowLeft')  focus.latTarget = this.#focus.snapLatToRow(focus.latTarget + rowDegLat);
            if (e.key === 'ArrowRight') focus.latTarget = this.#focus.snapLatToRow(focus.latTarget - rowDegLat);
        }
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

