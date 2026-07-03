import * as THREE from 'three';

// ----------------------------------------------------------------------
// HighlightManager — owns every overlay mesh that draws ON TOP of the body
// to show what's hovered or selected:
//   * highlight / highlightEdges       — the yellow hover overlay,
//   * selection / selectionEdges       — the blue VIEW-mode surface anchor,
//   * resourceSelection / …Edges       — the blue cell picked on the cliff.
//
// It is purely about geometry + visibility of those overlays; the coordinate
// read-outs live in the HUD and the picking lives in the pickers. The SHAPE
// of a resource-mode overlay (a sliced cross-section for lon/lat, a whole
// cell for the hexsphere) is decided by the topology's injected
// resource-highlight strategy.
// ----------------------------------------------------------------------
export class HighlightManager
{
    highlight;
    highlightEdges;
    selection;
    selectionEdges;
    resourceSelection;
    resourceSelectionEdges;

    #scene;
    #resourceHighlight;
    #geometryFactory;
    #state;

    constructor(scene, resourceHighlight, geometryFactory, state)
    {
        this.#scene = scene;
        this.#resourceHighlight = resourceHighlight;
        this.#geometryFactory = geometryFactory;
        this.#state = state;

        this.#buildMeshes();
    }

    #buildMeshes()
    {
        this.highlight = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0xfff2a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
                depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
            }),
        );
        this.highlight.visible = false;
        this.#scene.add(this.highlight);

        this.highlightEdges = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xffe66b }),
        );
        this.highlightEdges.visible = false;
        this.#scene.add(this.highlightEdges);

        this.selection = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0x6fb0ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
                depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
            }),
        );
        this.selection.visible = false;
        this.#scene.add(this.selection);

        this.selectionEdges = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x9fd0ff }),
        );
        this.selectionEdges.visible = false;
        this.#scene.add(this.selectionEdges);

        this.resourceSelection = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0x6fb0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
                depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
            }),
        );
        this.resourceSelection.visible = false;
        this.#scene.add(this.resourceSelection);

        this.resourceSelectionEdges = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x9fd0ff }),
        );
        this.resourceSelectionEdges.visible = false;
        this.#scene.add(this.resourceSelectionEdges);
    }

    get hoveredCell()
    {
        return this.highlight.userData.cell ?? null;
    }

    // --- Hover overlay -------------------------------------------------

    showHover(cell, mode)
    {
        if (this.highlight.userData.ownsGeom)
        {
            this.highlight.geometry.dispose();
            this.highlightEdges.geometry.dispose();
            this.highlight.userData.ownsGeom = false;
        }

        if (mode === 'resource')
        {
            const geom = this.#resourceHighlight.build(cell);
            this.highlight.geometry = geom;
            const thresh = cell.kind === 'cap' ? 30 : 1;
            this.highlightEdges.geometry = new THREE.EdgesGeometry(geom, thresh);
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

    // --- View-mode surface selection -----------------------------------

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

    // --- Resource-mode cliff selection ---------------------------------

    // Rebuild the blue cliff selection from `state.resourceSelected`. The
    // cross-section depends on the cut, so it's rebuilt whenever the cut
    // moves; if the cell no longer meets the cut, the mesh hides.
    rebuildResourceSelection()
    {
        const cell = this.#state.resourceSelected;

        if (this.#state.mode !== 'resource' || cell === null)
        {
            this.resourceSelection.visible = this.resourceSelectionEdges.visible = false;

            return;
        }

        this.resourceSelection.geometry.dispose();
        this.resourceSelectionEdges.geometry.dispose();

        const geom = this.#resourceHighlight.build(cell);
        const hasGeom = geom.getAttribute('position') && geom.getAttribute('position').count > 0;

        this.resourceSelection.geometry = geom;
        const thresh = cell.kind === 'cap' ? 30 : 1;
        this.resourceSelectionEdges.geometry = new THREE.EdgesGeometry(geom, thresh);
        this.resourceSelection.visible = hasGeom;
        this.resourceSelectionEdges.visible = hasGeom;
    }

    clearResourceSelection()
    {
        this.resourceSelection.visible = this.resourceSelectionEdges.visible = false;
    }

    // --- Geometry builders ---------------------------------------------

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
            const thresh = cell.kind === 'cap' ? 30 : 1;
            cell.edges = new THREE.EdgesGeometry(this.#getCellGeom(cell), thresh);
        }

        return cell.edges;
    }
}


