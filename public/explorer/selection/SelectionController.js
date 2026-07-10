// ----------------------------------------------------------------------
// SelectionController -- owns surface and resource cell selection, the
// click-to-glide logic, and the HUD + highlight updates that follow a
// selection. BodyInteractionSession delegates selection to this controller
// so selection concern stays isolated. Exact behaviour matches the
// pre-refactor inline code.
// ----------------------------------------------------------------------
export class SelectionController
{
    #state;
    #topology;
    #highlights;
    #hud;

    constructor({ state, topology, highlights, hud })
    {
        this.#state = state;
        this.#topology = topology;
        this.#highlights = highlights;
        this.#hud = hud;
    }

    selectSurface(cell)
    {
        const state = this.#state;
        state.selected = cell;
        this.#highlights.showSurfaceSelection(cell);

        state.focus.lon = cell.lon;
        state.focus.lat = cell.lat;

        this.#hud.setSelectedSurfaceReadout(cell);
        this.#hud.updateSelectionReadout(state);
        this.#hud.refreshModeButton(true);
    }

    selectResource(cell)
    {
        const state = this.#state;
        state.resourceSelected = cell;
        this.#highlights.rebuildResourceSelection();

        this.#topology.traversal.focusCell(state.focus, cell);

        this.#hud.updateSelectionReadout(state);
    }
}
