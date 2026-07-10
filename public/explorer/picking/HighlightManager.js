import * as THREE from 'three';
import { HighlightMeshFactory } from './HighlightMeshFactory.js';

// HighlightManager -- owns every overlay mesh that draws ON TOP of the body
// to show what is hovered or selected:
//   * highlight / highlightEdges       -- the yellow hover overlay,
//   * selection / selectionEdges       -- the blue VIEW-mode surface anchor,
//   * resourceSelection / resourceSelectionEdges -- the blue cell picked on
//     the cliff.
//
// It is purely about geometry + visibility of those overlays; the coordinate
// read-outs live in the HUD and the picking lives in the pickers. The SHAPE
// of a resource-mode overlay (a whole cell for the hexsphere) is decided by
// the topology's injected resource-highlight strategy.
export class HighlightManager
{
    highlight;
    highlightEdges;
    selection;
    selectionEdges;
    resourceSelection;
    resourceSelectionEdges;

    #bodyGroup;
    #resourceHighlight;
    #geometryFactory;
    #state;
    #disposed = false;

    constructor(bodyGroup, resourceHighlight, geometryFactory, state, highlightFactory = null)
    {
        this.#bodyGroup = bodyGroup;
        this.#resourceHighlight = resourceHighlight;
        this.#geometryFactory = geometryFactory;
        this.#state = state;

        this.#buildMeshes(highlightFactory ?? new HighlightMeshFactory());
    }

    #buildMeshes(factory)
    {
        const meshes = factory.buildAll(this.#bodyGroup);

        this.highlight             = meshes.highlight;
        this.highlightEdges        = meshes.highlightEdges;
        this.selection             = meshes.selection;
        this.selectionEdges        = meshes.selectionEdges;
        this.resourceSelection     = meshes.resourceSelection;
        this.resourceSelectionEdges = meshes.resourceSelectionEdges;
    }

    get hoveredCell()
    {
        return this.highlight.userData.cell ?? null;
    }

    get resourceHoverIsStatic()
    {
        return this.#resourceHighlight.isStatic;
    }

    showHover(cell, mode)
    {
        if (this.highlight.userData.ownsGeom)
        {
            if (!this.#resourceHighlight.isStatic)
            {
                this.highlight.geometry.dispose();
                this.highlightEdges.geometry.dispose();
            }

            this.highlight.userData.ownsGeom = false;
        }

        if (mode === 'resource')
        {
            const geom = this.#resourceHighlight.build(cell);
            this.highlight.geometry = geom;
            this.highlightEdges.geometry = this.#resourceHighlight.buildEdges
                ? this.#resourceHighlight.buildEdges(cell, 1)
                : new THREE.EdgesGeometry(geom, 1);
            this.highlight.userData.ownsGeom = true;
        }
        else
        {
            this.highlight.geometry = this.#getCellGeom(cell);
            this.highlightEdges.geometry = this.#getCellEdges(cell);
        }

        // Atmosphere cells are see-through: show only their wireframe box.
        this.highlight.visible = !(mode === 'resource' && cell.isAtmosphere);
        this.highlightEdges.visible = true;
        this.highlight.userData.cell = cell;
    }

    hideHover()
    {
        this.highlight.visible = false;
        this.highlightEdges.visible = false;
        this.highlight.userData.cell = null;
    }

    showSurfaceSelection(cell)
    {
        this.selection.geometry = this.#getCellGeom(cell);
        this.selectionEdges.geometry = this.#getCellEdges(cell);
        this.selection.visible = this.selectionEdges.visible = true;
    }

    setSurfaceSelectionVisible(visible)
    {
        this.selection.visible = this.selectionEdges.visible = visible;
    }

    // Rebuild the blue cliff selection from `state.resourceSelected`. The
    // geometry depends on the cut, so it is rebuilt whenever the cut moves;
    // if the cell no longer meets the cut, the mesh hides.
    rebuildResourceSelection()
    {
        const cell = this.#state.resourceSelected;

        if (this.#state.mode !== 'resource' || cell === null)
        {
            this.resourceSelection.visible = this.resourceSelectionEdges.visible = false;

            return;
        }

        if (!this.#resourceHighlight.isStatic)
        {
            this.resourceSelection.geometry.dispose();
            this.resourceSelectionEdges.geometry.dispose();
        }

        const geom = this.#resourceHighlight.build(cell);
        const hasGeom = geom.getAttribute('position') && geom.getAttribute('position').count > 0;

        this.resourceSelection.geometry = geom;
        this.resourceSelectionEdges.geometry = this.#resourceHighlight.buildEdges
            ? this.#resourceHighlight.buildEdges(cell, 1)
            : new THREE.EdgesGeometry(geom, 1);
        this.resourceSelection.visible = hasGeom;
        this.resourceSelectionEdges.visible = hasGeom;
    }

    clearResourceSelection()
    {
        this.resourceSelection.visible = this.resourceSelectionEdges.visible = false;
    }

    // Lazy per-cell FULL-hex geometry (view-mode overlay).
    #getCellGeom(cell)
    {
        if (!cell.geom) cell.geom = this.#geometryFactory.buildSingleCellGeometry(cell);

        return cell.geom;
    }

    #getCellEdges(cell)
    {
        if (!cell.edges)
        {
            cell.edges = new THREE.EdgesGeometry(this.#getCellGeom(cell), 1);
        }

        return cell.edges;
    }

    // Releases materials and owned (non-cell-cached) geometries. Cell-cached
    // geometries (cell.geom, cell.edges) are shared and must NOT be disposed here.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        const meshes = [
            this.highlight, this.highlightEdges,
            this.selection, this.selectionEdges,
            this.resourceSelection, this.resourceSelectionEdges,
        ];

        for (const m of meshes)
        {
            m.removeFromParent();
            m.material.dispose();
        }

        if (this.highlight.userData.ownsGeom && !this.#resourceHighlight.isStatic)
        {
            this.highlight.geometry.dispose();
            this.highlightEdges.geometry.dispose();
        }
    }
}
