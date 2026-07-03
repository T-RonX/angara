// ----------------------------------------------------------------------
// WholeCellResourceHighlight — the resource-mode hover / selection overlay
// for the hexsphere. Because the cut snaps to cell boundaries (cells are
// never sliced), the highlighted cell is always a COMPLETE prism, so the
// overlay is simply the whole-cell geometry — no cross-section carving.
// ----------------------------------------------------------------------
export class WholeCellResourceHighlight
{
    #geometryFactory;

    constructor(geometryFactory)
    {
        this.#geometryFactory = geometryFactory;
    }

    build(cell)
    {
        return this.#geometryFactory.buildSingleCellGeometry(cell);
    }
}
