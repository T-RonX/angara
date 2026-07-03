// ----------------------------------------------------------------------
// LonLatTraversal — how the focus point moves in resource mode for the
// longitude/latitude topology: snapping a stroll onto the nearest cell,
// stepping one cell at a time with the arrows, and dragging along the
// surface. In latitude-traversal mode the polar caps are valid stops so the
// pole's layer view is reachable (and exitable) one step at a time.
// ----------------------------------------------------------------------
export class LonLatTraversal
{
    #planet;
    #capModel;
    #latStops;
    #traverseAxis;
    #input;

    constructor(planet, capModel, latStops, traverseAxis, input)
    {
        this.#planet = planet;
        this.#capModel = capModel;
        this.#latStops = latStops;
        this.#traverseAxis = traverseAxis;
        this.#input = input;
    }

    // Set the focus (and its targets) when entering resource mode on `cell`.
    enterFocus(focus, cell)
    {
        focus.lonTarget = this.#snapLonToCol(cell.lon);
        focus.latTarget = this.#snapLatToRow(cell.lat);
        focus.lon = focus.lonTarget;
        focus.lat = focus.latTarget;
    }

    // Snap the drag targets to the nearest valid cell (on pointer release).
    snapTargets(focus)
    {
        focus.lonTarget = this.#snapLonToCol(focus.lonTarget);
        focus.latTarget = this.#snapLatToRow(focus.latTarget);
    }

    onDrag(focus, dx, dy, dpp)
    {
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
            focus.latTarget = Math.max(latMin, Math.min(latMax,
                focus.latTarget + dy * dpp.lat * this.#input.dragDirectionY));
            focus.lonTarget = (focus.lonTarget + dx * dpp.lon * this.#input.dragDirectionX + 360) % 360;
        }
        else
        {
            // Vertical drag travels along longitude (around the equator);
            // horizontal pans latitude along the meridian cliff.
            focus.lonTarget = (focus.lonTarget + dy * dpp.lon * this.#input.dragDirectionY + 360) % 360;
            focus.latTarget = Math.max(minLat, Math.min(maxLat,
                focus.latTarget + dx * dpp.lat * this.#input.dragDirectionX));
        }
    }

    onArrow(focus, key)
    {
        const { capRows, rowDegLat } = this.#capModel;
        const colDeg = 360 / this.#planet.lonCells;

        if (this.#traverseAxis === 'latitude')
        {
            if (key === 'ArrowUp' || key === 'ArrowDown')
            {
                const dir = key === 'ArrowUp' ? 1 : -1;
                const i = capRows > 0
                    ? Math.max(0, Math.min(this.#latStops.length - 1,
                        this.#latStops.nearestIndex(focus.latTarget) + dir))
                    : null;
                focus.latTarget = i !== null
                    ? this.#latStops.at(i)
                    : this.#snapLatToRow(focus.latTarget + dir * rowDegLat);
            }

            if (key === 'ArrowLeft')  focus.lonTarget = this.#snapLonToCol(focus.lonTarget - colDeg);
            if (key === 'ArrowRight') focus.lonTarget = this.#snapLonToCol(focus.lonTarget + colDeg);
        }
        else
        {
            if (key === 'ArrowUp')    focus.lonTarget = this.#snapLonToCol(focus.lonTarget + colDeg);
            if (key === 'ArrowDown')  focus.lonTarget = this.#snapLonToCol(focus.lonTarget - colDeg);
            if (key === 'ArrowLeft')  focus.latTarget = this.#snapLatToRow(focus.latTarget + rowDegLat);
            if (key === 'ArrowRight') focus.latTarget = this.#snapLatToRow(focus.latTarget - rowDegLat);
        }
    }

    // Which axis moves the cut depends on the traversal mode.
    cutMoved(lonChanged, latChanged)
    {
        return this.#traverseAxis === 'latitude'
            ? (lonChanged || latChanged)
            : lonChanged;
    }

    // Snap a latitude to the nearest valid stop. In latitude-traversal mode
    // the polar caps are valid stops (so the pole's layer view is reachable).
    #snapLatToRow(lat)
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
    #snapLonToCol(lon)
    {
        const colDeg = 360 / this.#planet.lonCells;
        const norm = ((lon % 360) + 360) % 360;
        const idx = Math.round((norm - colDeg / 2) / colDeg);

        return ((idx * colDeg + colDeg / 2) % 360 + 360) % 360;
    }
}
