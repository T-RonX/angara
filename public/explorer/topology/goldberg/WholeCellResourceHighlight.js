import * as THREE from 'three';

// ----------------------------------------------------------------------
// WholeCellResourceHighlight — the resource-mode hover / selection overlay
// for the hexsphere. Because the cut snaps to cell boundaries (cells are
// never sliced), the highlighted cell is always a COMPLETE prism, so the
// overlay is simply the whole-cell geometry — no cross-section carving.
// ----------------------------------------------------------------------
export class WholeCellResourceHighlight
{
    #geometryFactory;

    isStatic = true;

    constructor(geometryFactory)
    {
        this.#geometryFactory = geometryFactory;
    }

    build(cell)
    {
        if (!cell.resourceGeometry)
        {
            cell.resourceGeometry = this.#geometryFactory.buildSingleCellGeometry(cell);
        }

        return cell.resourceGeometry;
    }

    buildEdges(cell, threshold)
    {
        if (!cell.resourceEdges || cell.resourceEdgeThreshold !== threshold)
        {
            if (cell.resourceEdges)
            {
                cell.resourceEdges.dispose();
            }

            cell.resourceEdges = new THREE.EdgesGeometry(this.build(cell), threshold);
            cell.resourceEdgeThreshold = threshold;
        }

        return cell.resourceEdges;
    }
}
