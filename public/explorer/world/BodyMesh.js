import * as THREE from 'three';

// ----------------------------------------------------------------------
// BodyMesh — turns the CellGrid records into the actual rendered body:
// ONE merged mesh per depth layer (so the GPU draws each shell in a single
// call) plus the inner core sphere. Each merged mesh carries a
// `faceToCell` table so a raycast hit maps back to the cell it belongs to.
//
// Sub-surface layers are hidden in view mode (occluded by the surface) and
// in resource mode (the cut caps + surface cover everything visible), which
// keeps the fragment workload flat.
// ----------------------------------------------------------------------
export class BodyMesh
{
    group;
    depthMeshes = [];
    surfaceMeshes;
    core;

    #materialFactory;
    #disposed = false;

    constructor(scene, cellGrid, geometryFactory, materialFactory, layerModel, surfaceData = null)
    {
        this.#materialFactory = materialFactory;

        this.group = new THREE.Group();
        scene.add(this.group);

        // Core — sized to exactly fill the deepest cell's inner radius so it
        // touches the bottom of the crust with no annular gap on the cut.
        this.core = new THREE.Mesh(
            new THREE.SphereGeometry(layerModel.coreRadius, 96, 64),
            materialFactory.coreMaterial,
        );
        this.group.add(this.core);

        this.#buildDepthMeshes(cellGrid, geometryFactory, layerModel, surfaceData);

        this.surfaceMeshes = [this.depthMeshes[0]];
    }

    #buildDepthMeshes(cellGrid, geometryFactory, layerModel, surfaceData)
    {
        // Only the SURFACE shell (depth 0) is ever rendered by the base body:
        // view mode shows just the surface, and hexsphere resource mode hides
        // the base meshes entirely and rebuilds the visible cliff from cell
        // records (CellSliceBuilder). The deeper shells (depth 1..N) were only
        // ever built to be immediately hidden — a large, pure init cost at high
        // hexFrequency — so they are not materialised here. The per-depth
        // MATERIALS still exist (the slice builder reuses them); only the dead
        // hidden meshes are skipped. `depthMeshes` keeps its by-depth indexing
        // for the visibility helpers, padded with nulls for the absent shells.
        for (let d = 0; d < layerModel.maxDepth; d++)
        {
            if (d > 0)
            {
                this.depthMeshes.push(null);

                continue;
            }

            const mesh = surfaceData
                ? this.#surfaceMeshFromData(surfaceData, cellGrid, d)
                : this.#surfaceMeshFromCells(cellGrid, geometryFactory, d);

            this.group.add(mesh);
            this.depthMeshes.push(mesh);
        }
    }

    // Build the depth-0 surface mesh from the worker's prebuilt geometry
    // (positions/normals/indices already computed off-thread). `faceCellIndex`
    // maps each triangle back to its surface cell record for picking.
    #surfaceMeshFromData(surfaceData, cellGrid, d)
    {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(surfaceData.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(surfaceData.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(surfaceData.indices, 1));
        geo.computeBoundingSphere();

        const ids = surfaceData.faceCellIndex;
        const faceToCell = new Array(ids.length);

        for (let t = 0; t < ids.length; t++)
        {
            faceToCell[t] = cellGrid.surfaceByIndex.get(ids[t]);
        }

        const mesh = new THREE.Mesh(geo, this.#materialFactory.depthMaterials[d]);
        mesh.userData.depth = d;
        mesh.userData.faceToCell = faceToCell;

        return mesh;
    }

    #surfaceMeshFromCells(cellGrid, geometryFactory, d)
    {
        const positions = [];
        const normals = [];
        const indices = [];
        const faceToCell = [];

        for (const cell of cellGrid.cellsByDepth[d])
        {
            const triStart = indices.length / 3;
            geometryFactory.appendCell(cell, positions, normals, indices);

            for (let t = triStart; t < indices.length / 3; t++)
            {
                faceToCell.push(cell);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, this.#materialFactory.depthMaterials[d]);
        mesh.userData.depth = d;
        mesh.userData.faceToCell = faceToCell;

        return mesh;
    }

    add(object)
    {
        this.group.add(object);
    }

    // Release owned geometries and remove the group from the scene.
    // Does NOT dispose shared materials (LayerMaterialFactory owns those).
    // Idempotent.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        // Dispose owned depth-mesh geometries (only depth 0 is materialised).
        for (const m of this.depthMeshes)
        {
            if (m) m.geometry?.dispose();
        }

        // Dispose core sphere geometry.
        this.core?.geometry?.dispose();

        // Remove all children added via add() (grid lines, etc.)
        // and the group itself from the scene.
        this.group.removeFromParent();
    }

    // Enable / disable resource-mode clipping. Sub-surface layers stay hidden
    // either way (see the class note for the performance reason).
    applyClipping(enabled, clipPlane)
    {
        const planes = enabled ? [clipPlane] : [];

        for (const m of this.#materialFactory.depthMaterials)
        {
            m.clippingPlanes = planes;
            m.needsUpdate = true;
        }

        this.core.material.clippingPlanes = planes;
        this.core.material.needsUpdate = true;

        for (let d = 1; d < this.depthMeshes.length; d++)
        {
            if (this.depthMeshes[d]) this.depthMeshes[d].visible = false;
        }
    }

    // Hexsphere resource mode replaces the whole body with a rebuilt slice
    // group, so the base depth meshes are hidden entirely (the unclipped core
    // stays visible as the slice's floor).
    hideAll()
    {
        for (const m of this.depthMeshes)
        {
            if (m) m.visible = false;
        }
    }

    // Restore view-mode visibility: only the surface layer shows (deeper
    // shells stay occluded, matching the constructor's initial state).
    restoreView()
    {
        for (let d = 0; d < this.depthMeshes.length; d++)
        {
            if (this.depthMeshes[d]) this.depthMeshes[d].visible = d === 0;
        }
    }
}

