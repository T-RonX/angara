import * as THREE from 'three';
import { sphere } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// HighlightManager — owns every overlay mesh that draws ON TOP of the body
// to show what's hovered or selected:
//   * highlight / highlightEdges       — the yellow hover overlay,
//   * selection / selectionEdges       — the blue VIEW-mode surface anchor,
//   * resourceSelection / …Edges       — the blue cell picked on the cliff.
//
// It is purely about geometry + visibility of those overlays; the coordinate
// read-outs live in the HUD and the picking lives in the pickers.
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
    #crossSection;
    #geometryFactory;
    #clip;
    #state;
    #rings;

    constructor(scene, crossSectionFactory, geometryFactory, clipController, state, polarCapRings)
    {
        this.#scene = scene;
        this.#crossSection = crossSectionFactory;
        this.#geometryFactory = geometryFactory;
        this.#clip = clipController;
        this.#state = state;
        this.#rings = Math.max(2, polarCapRings ?? 4);

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
            const geom = this.buildResourceHighlightGeometry(cell);
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

        const geom = this.buildResourceHighlightGeometry(cell);
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

    // A slim mesh covering only what's visible of a cell carved open by the
    // cut: the cross-section face (always) plus, on the surface layer, the
    // outer face wrapping over the cliff top.
    buildResourceHighlightGeometry(cell)
    {
        // Atmosphere cells are see-through → wireframe box of the whole cell.
        if (cell.isAtmosphere)
        {
            return this.#geometryFactory.buildSingleCellGeometry(cell);
        }

        const positions = [];
        const normals = [];
        const indices = [];
        const n = this.#clip.plane.normal;

        // (a) Cross-section face on the clip plane.
        const cross = this.#crossSection.cellCrossSection(cell);

        if (cross !== null)
        {
            const base = positions.length / 3;

            for (const p of cross.positions)
            {
                positions.push(p.x, p.y, p.z);
                normals.push(-n.x, -n.y, -n.z);
            }

            for (const i of cross.indices)
            {
                indices.push(base + i);
            }
        }

        // (b) On the surface layer, also include the outer face so the
        // highlight wraps over the top edge of the cliff.
        if (cell.depth === 0 && cell.kind !== 'cap')
        {
            const clipped = this.#crossSection.clipPolygonToVisibleHalf(cell.outerRing);

            if (clipped.length >= 3)
            {
                const base = positions.length / 3;

                for (const p of clipped)
                {
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    positions.push(p.x, p.y, p.z);
                    normals.push(p.x / len, p.y / len, p.z / len);
                }

                for (let t = 1; t < clipped.length - 1; t++)
                {
                    indices.push(base, base + t, base + t + 1);
                }
            }
        }
        else if (cell.depth === 0 && cell.kind === 'cap')
        {
            this.#appendCapOuterSkin(cell, positions, normals, indices);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        return geo;
    }

    // Outer skin of a polar cap, clipped to the visible half-dome — so
    // hovering a polar cap lights up the whole pole, not just a sliver.
    #appendCapOuterSkin(cell, positions, normals, indices)
    {
        const { boundaryLat, rOuter, sign, fan } = cell;
        const rings = this.#rings;
        const poleLat = sign * 90;
        const outerRings = [];

        for (let i = 0; i <= rings; i++)
        {
            const t = i / rings;
            const lat = poleLat + (boundaryLat - poleLat) * t;
            const ring = new Array(fan);

            for (let j = 0; j < fan; j++)
            {
                ring[j] = sphere((j / fan) * 360, lat, rOuter);
            }

            outerRings.push(ring);
        }

        for (let i = 0; i < rings; i++)
        {
            const r0 = outerRings[i];
            const r1 = outerRings[i + 1];

            for (let j = 0; j < fan; j++)
            {
                const j2 = (j + 1) % fan;
                const a = r0[j], b = r0[j2], c = r1[j2], d = r1[j];
                const ring = sign > 0 ? [a, b, c, d] : [a, d, c, b];
                const clipped = this.#crossSection.clipPolygonToVisibleHalf(ring);

                if (clipped.length < 3) continue;

                const base = positions.length / 3;

                for (const p of clipped)
                {
                    positions.push(p.x, p.y, p.z);
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    normals.push(p.x / len, p.y / len, p.z / len);
                }

                for (let tri = 1; tri < clipped.length - 1; tri++)
                {
                    indices.push(base, base + tri, base + tri + 1);
                }
            }
        }
    }
}

