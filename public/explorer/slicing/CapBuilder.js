import * as THREE from 'three';

// ----------------------------------------------------------------------
// CapBuilder — closes every sliced cell with a flat polygon ON the clip
// plane so the cut reads as solid (the cells are really cut, not hidden).
// One merged cap mesh per depth (cheap draw calls), each carrying a
// faceIndex → cell map so the cliff stays clickable. Also caps the core and
// emits a near-invisible atmosphere cross-section strip.
//
// It never tests every cell: the topology's broad-phase narrows the work to
// the cells the plane can actually cross (and skips the offset-plane sweep's
// non-crossable cells), keeping the rebuild cheap.
// ----------------------------------------------------------------------
export class CapBuilder
{
    capsGroup;
    capMeshes = [];

    #clip;
    #cellGrid;
    #crossSection;
    #materials;
    #layerModel;
    #focus;
    #broadPhase;

    constructor(scene, clipController, cellGrid, crossSectionFactory, materialFactory, layerModel, focus, broadPhase)
    {
        this.#clip = clipController;
        this.#cellGrid = cellGrid;
        this.#crossSection = crossSectionFactory;
        this.#materials = materialFactory;
        this.#layerModel = layerModel;
        this.#focus = focus;
        this.#broadPhase = broadPhase;

        this.capsGroup = new THREE.Group();
        scene.add(this.capsGroup);
    }

    clearCaps()
    {
        while (this.capsGroup.children.length > 0)
        {
            const cap = this.capsGroup.children[this.capsGroup.children.length - 1];
            this.capsGroup.remove(cap);
            cap.geometry.dispose();
        }

        this.capMeshes.length = 0;
    }

    // `slab`: the topology broad-phase uses the offset-plane sweep test.
    build(slab = false)
    {
        this.clearCaps();

        const plane = this.#clip.plane;
        const n = plane.normal;
        const k = plane.constant;
        const maxDepth = this.#layerModel.maxDepth;

        // Merged cap buffers, one per depth.
        const buffers = [];
        for (let d = 0; d < maxDepth; d++)
        {
            buffers.push({ positions: [], normals: [], faceToCell: [] });
        }

        this.#broadPhase.prepare(plane, this.#focus, slab);

        for (let d = 0; d < maxDepth; d++)
        {
            for (const cell of this.#cellGrid.cellsByDepth[d])
            {
                if (!this.#broadPhase.accept(cell)) continue;

                const cross = this.#crossSection.cellCrossSection(cell);

                if (cross === null) continue;

                this.#emitCross(buffers[d], cross, cell, n);
            }
        }

        this.#emitCapMeshes(buffers);

        if (this.#cellGrid.atmosphereCells.length > 0 && !slab)
        {
            this.#emitAtmosphereCaps(n);
        }

        this.#emitCoreCap(n, k);
    }

    #emitCross(buf, cross, cell, n)
    {
        const pts = cross.positions;
        const idx = cross.indices;

        for (let t = 0; t < idx.length; t += 3)
        {
            const a = pts[idx[t]];
            const b = pts[idx[t + 1]];
            const c = pts[idx[t + 2]];

            for (const p of [a, b, c])
            {
                buf.positions.push(p.x, p.y, p.z);
                buf.normals.push(-n.x, -n.y, -n.z);
            }

            buf.faceToCell.push(cell);
        }
    }

    #emitCapMeshes(buffers)
    {
        for (let d = 0; d < this.#layerModel.maxDepth; d++)
        {
            const buf = buffers[d];

            if (buf.positions.length === 0) continue;

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
            geo.computeBoundingSphere();

            const cap = new THREE.Mesh(geo, this.#materials.capMaterials[d]);
            cap.userData.faceToCell = buf.faceToCell;
            this.capsGroup.add(cap);
            this.capMeshes.push(cap);
        }
    }

    #emitAtmosphereCaps(n)
    {
        const aPos = [];
        const aNorm = [];
        const aF2C = [];

        for (const cell of this.#cellGrid.atmosphereCells)
        {
            if (!this.#broadPhase.accept(cell)) continue;

            const cross = this.#crossSection.cellCrossSection(cell);

            if (cross === null) continue;

            this.#emitCross({ positions: aPos, normals: aNorm, faceToCell: aF2C }, cross, cell, n);
        }

        if (aPos.length === 0) return;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(aNorm, 3));
        geo.computeBoundingSphere();

        const cap = new THREE.Mesh(geo, this.#materials.atmosphereCapMaterial);
        cap.userData.faceToCell = aF2C;
        this.capsGroup.add(cap);
        this.capMeshes.push(cap);
    }

    #emitCoreCap(n, k)
    {
        const coreR = this.#layerModel.coreRadius;

        if (coreR * coreR <= k * k) return;

        const discR = Math.sqrt(coreR * coreR - k * k);
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(discR, 48),
            this.#materials.coreCapMaterial,
        );
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        disc.position.copy(n).multiplyScalar(-k);
        this.capsGroup.add(disc);
        // Not added to capMeshes — the core isn't a clickable cell.
    }
}
