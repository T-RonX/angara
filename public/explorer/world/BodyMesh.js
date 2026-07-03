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

    constructor(scene, cellGrid, geometryFactory, materialFactory, layerModel)
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

        this.#buildDepthMeshes(cellGrid, geometryFactory, layerModel);

        this.surfaceMeshes = [this.depthMeshes[0]];
    }

    #buildDepthMeshes(cellGrid, geometryFactory, layerModel)
    {
        for (let d = 0; d < layerModel.maxDepth; d++)
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

            // Sub-surface cells are fully occluded by the surface in view mode.
            if (d > 0) mesh.visible = false;

            this.group.add(mesh);
            this.depthMeshes.push(mesh);
        }
    }

    add(object)
    {
        this.group.add(object);
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
            this.depthMeshes[d].visible = false;
        }
    }
}

