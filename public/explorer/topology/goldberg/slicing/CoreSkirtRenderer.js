import * as THREE from 'three';

// Renders the "skirt" apron that closes the resource-mode gap between the round
// core sphere and the jagged bottom of the deepest crust cells (the cliff wall
// band). Unlike a flat cut-plane disc — which floats in the through-centre cut
// plane and cannot follow the 3D staircase of cell bottoms — this attaches to
// the REAL deepest cells: for each kept deepest cell it builds a band from the
// cell's own inner ring (its jagged bottom, radius innerR) sloping inward-down
// to the round core sphere (each corner projected to coreRadius).
//
// - Outer edge = the cell's innerRing → jagged, touches the cells exactly and
//   is bounded by them, so it can never overshoot the body.
// - Inner edge = corners projected onto the core (û·coreR). Adjacent cells share
//   corners, so the hem is a continuous spherical-polygon ring that reads round.
// - One quad per ring edge → a single flat sloped surface per cell (no vertical
//   walls following the cell sides, so no confusing layered look).
//
// Rebuilt every cut advance from the collector's deepest-depth kept set (small:
// the wall band only), like the core disc.
export class CoreSkirtRenderer
{
    #sliceGroup;
    #layerModel;
    #materials;
    #meshes = [];

    constructor({ sliceGroup, layerModel, materials })
    {
        this.#sliceGroup = sliceGroup;
        this.#layerModel = layerModel;
        this.#materials  = materials;
    }

    // Non-pickable depth blockers (no faceToCell) — included in capMeshes only so
    // the picker treats hits on them as "no pick".
    get meshes() { return this.#meshes; }

    // Rebuild the apron from the deepest kept cells (byDepth[maxDepth-1]).
    rebuild(deepCells)
    {
        this.clear();

        if (!deepCells || deepCells.length === 0) return;

        this.#emit(deepCells);
    }

    clear()
    {
        for (const m of this.#meshes)
        {
            this.#sliceGroup.remove(m);
            m.geometry.dispose();
        }

        this.#meshes.length = 0;
    }

    dispose()
    {
        this.clear();
    }

    #emit(deepCells)
    {
        const coreR = this.#layerModel.coreRadius;

        // Sum quad counts up front (one quad per inner-ring edge per cell).
        let edgeCount = 0;

        for (const cell of deepCells) edgeCount += cell.innerRing.length;

        const positions = new Float32Array(edgeCount * 6 * 3); // 2 tris (6 verts) per edge
        const normals   = new Float32Array(edgeCount * 6 * 3);

        let off = 0;

        const co  = new THREE.Vector3();
        const ci  = new THREE.Vector3();
        const po  = new THREE.Vector3();
        const pi  = new THREE.Vector3();
        const nrm = new THREE.Vector3();
        const e1  = new THREE.Vector3();
        const e2  = new THREE.Vector3();

        for (const cell of deepCells)
        {
            const ring = cell.innerRing;
            const n = ring.length;

            for (let k = 0; k < n; k++)
            {
                const a = ring[k];
                const b = ring[(k + 1) % n];

                // Outer edge = cell bottom corners; inner edge = same directions
                // projected onto the core sphere.
                co.copy(a);
                ci.copy(b);
                po.copy(a).normalize().multiplyScalar(coreR);
                pi.copy(b).normalize().multiplyScalar(coreR);

                // Flat quad normal (double-sided material, so orientation only
                // affects lighting): (b-a) × (po-a).
                e1.copy(ci).sub(co);
                e2.copy(po).sub(co);
                nrm.crossVectors(e1, e2);

                if (nrm.lengthSq() < 1e-12) continue;

                nrm.normalize();

                // Triangles: (co, ci, pi) and (co, pi, po).
                off = this.#pushVert(positions, normals, off, co, nrm);
                off = this.#pushVert(positions, normals, off, ci, nrm);
                off = this.#pushVert(positions, normals, off, pi, nrm);
                off = this.#pushVert(positions, normals, off, co, nrm);
                off = this.#pushVert(positions, normals, off, pi, nrm);
                off = this.#pushVert(positions, normals, off, po, nrm);
            }
        }

        if (off === 0) return;

        const posView = off === positions.length ? positions : positions.subarray(0, off);
        const nrmView = off === normals.length ? normals : normals.subarray(0, off);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posView, 3));
        geo.setAttribute('normal',   new THREE.BufferAttribute(nrmView, 3));
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, this.#materials.coreSkirtMaterial);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        this.#sliceGroup.add(mesh);
        this.#meshes.push(mesh);
    }

    #pushVert(positions, normals, off, p, nrm)
    {
        positions[off]     = p.x;
        positions[off + 1] = p.y;
        positions[off + 2] = p.z;
        normals[off]       = nrm.x;
        normals[off + 1]   = nrm.y;
        normals[off + 2]   = nrm.z;

        return off + 3;
    }
}
