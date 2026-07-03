// ----------------------------------------------------------------------
// FocusController — owns the "focus point" the crust view is centred on and
// everything about how it MOVES: snapping a stroll onto the nearest cell,
// and easing the visible focus toward its target every frame (the same
// damped feel as releasing an OrbitControls orbit). When the focus moves it
// drives the cut, the crust camera and the read-out.
// ----------------------------------------------------------------------
export class FocusController
{
    #state;
    #planet;
    #capModel;
    #latStops;
    #traverseAxis;
    #focusSnapEase;
    #clip;
    #crustCamera;
    #highlights;
    #hud;

    constructor(state, planet, capModel, latStops, behaviour, clipController, crustCamera, highlightManager, hud)
    {
        this.#state = state;
        this.#planet = planet;
        this.#capModel = capModel;
        this.#latStops = latStops;
        this.#traverseAxis = behaviour.traversal.resourceTraverseAxis;
        this.#focusSnapEase = behaviour.input.focusSnapEase;
        this.#clip = clipController;
        this.#crustCamera = crustCamera;
        this.#highlights = highlightManager;
        this.#hud = hud;
    }

    // Snap a latitude to the nearest valid stop. In latitude-traversal mode
    // the polar caps are valid stops (so the pole's layer view is reachable).
    snapLatToRow(lat)
    {
        const { capRows, rowDegLat } = this.#capModel;

        if (capRows > 0 && this.#traverseAxis === 'latitude')
        {
            return this.#latStops.at(this.#latStops.nearestIndex(lat));
        }

        const minLat = -90 + capRows * rowDegLat + rowDegLat / 2;
        const maxLat =  90 - capRows * rowDegLat - rowDegLat / 2;
        const clamped = Math.max(minLat, Math.min(maxLat, lat));
        const idx = Math.round((clamped - minLat) / rowDegLat);

        return minLat + idx * rowDegLat;
    }

    // Snap a longitude to the nearest quad-cell column (wraps at 0/360).
    snapLonToCol(lon)
    {
        const colDeg = 360 / this.#planet.lonCells;
        const norm = ((lon % 360) + 360) % 360;
        const idx = Math.round((norm - colDeg / 2) / colDeg);

        return ((idx * colDeg + colDeg / 2) % 360 + 360) % 360;
    }

    // Glide focus.{lon,lat} toward their targets; rebuild the cut/camera when
    // anything moved. Longitude eases along the shortest arc across 0/360.
    easeFocusToTarget()
    {
        const EPS = 1e-3;
        const ease = this.#focusSnapEase;
        const focus = this.#state.focus;
        let lonChanged = false;
        let latChanged = false;
        let moved = false;

        let dLon = focus.lonTarget - focus.lon;
        if (dLon > 180)  dLon -= 360;
        if (dLon < -180) dLon += 360;

        if (Math.abs(dLon) > EPS)
        {
            focus.lon = (focus.lon + dLon * ease + 360) % 360;
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
            focus.lat += dLat * ease;
            latChanged = true;
            moved = true;
        }
        else if (focus.lat !== focus.latTarget)
        {
            focus.lat = focus.latTarget;
            latChanged = true;
            moved = true;
        }

        // Which axis moves the cut depends on the traversal mode.
        const cutChanged = this.#traverseAxis === 'latitude'
            ? (lonChanged || latChanged)
            : lonChanged;

        if (moved) this.#updateResource(cutChanged);
    }

    // Rebuild the cut (only when it actually moved), re-aim the crust camera
    // and refresh the focus read-out.
    #updateResource(cutChanged)
    {
        if (cutChanged || this.#clip.cutLon === null)
        {
            this.#clip.updateCut();
            this.#highlights.rebuildResourceSelection();
        }

        this.#crustCamera.positionCrustCamera();
        this.#hud.updateFocusReadout(this.#state.focus);
    }
}

