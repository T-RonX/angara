import * as THREE from 'three';

// ----------------------------------------------------------------------
// CellSliceBuilder — the hexsphere SliceBuilder. Unlike the lon/lat CapBuilder
// (which GPU-clips the body with a plane and closes the sliced cells with flat
// cross-section caps), the hexsphere keeps WHOLE cells: a cell is included in
// the slice iff its centroid is on the kept (+normal) half of the cut, so the
// cut never carves through a cell. The whole near hemisphere (full surface +
// full-depth crust) is kept, so the cliff wall and the surface rim are a
// staircase of complete hexagon / pentagon cells and the full surface stays
// visible from the resource camera.
//
// The kept cells are rebuilt into lit meshes reusing the body's FrontSide
// depthMaterials (coincident interior walls of touching cells cull to a single
// face, so no z-fighting; the cut-facing side faces of the boundary cells point
// toward the camera and read as the solid cliff). Each mesh carries a
// faceIndex → cell table so CliffPicker keeps working.
//
// PERF — incremental, bucketed rebuild. The opaque slice is split into coarse
// lon/lat SECTOR buckets (one merged mesh per (depth, bucket)) so Three's
// frustum culling drops off-screen buckets, AND so a membership change only
// re-uploads the FEW buckets whose cell set actually changed. Persistent bucket
// meshes are kept across rebuilds; only changed buckets are disposed + rebuilt.
//
// CORE — the full core sphere would bulge into the cut-away region toward the
// camera, so — like the lon/lat path — the core material is clipped to the kept
// half; its cut face is filled by a solid full disc (#emitCoreDisc). The crust
// is a solid stack of whole cells over the kept hemisphere, so no layered
// cross-section backing is needed.
//
// FADE — newly revealed / leaving cells fade independently via a per-cell
// reveal time: each fading cell records an absolute start time `t0` and a
// direction, and a single global `uTime` uniform drives the alpha, so every
// in-flight cell keeps animating smoothly no matter how many rebuilds a
// continuous advance triggers. A cell folds into the opaque buckets only once
// its own fade-in completes.
//
// SliceBuilder contract: build(slab), capMeshes[], clearCaps(), enter(), exit().
// ----------------------------------------------------------------------
export class CellSliceBuilder
{
    sliceGroup;
    capMeshes = [];

    #clip;
    #cellGrid;
    #materials;
    #layerModel;
    #geometryFactory;
    #bodyMesh;
    #eps;
    #lastSig = null;
    #atmospherePickMaterial;

    // Persistent opaque slice: key `${depth}:${bucket}` → { mesh, sig }.
    #opaqueBuckets = new Map();
    // Transient meshes rebuilt each change: atmosphere pick shell + cross-section.
    #staticTransient = [];
    // Transient reveal-fade meshes (per-cell reveal-time driven).
    #fadeMeshList = [];

    // Per-cell reveal fade — see build()/tick().
    // #fading: cellKey → { cell, depth, dir (+1 in / -1 out), t0 (seconds) }.
    #fading = new Map();
    #lastKeys = null;      // membership Set from the previous build
    #lastByDepth = null;   // membership cells (per depth) from the previous build
    #clock = 0;            // monotonic seconds, drives the fade
    #fadeDur = 0.26;
    #timeUniform = { value: 0 };
    #durUniform = { value: 0.26 };
    #fadeMaterials = [];

    constructor(ctx)
    {
        this.#clip = ctx.clip;
        this.#cellGrid = ctx.cellGrid;
        this.#materials = ctx.materials;
        this.#layerModel = ctx.layerModel;
        this.#geometryFactory = ctx.geometryFactory;
        this.#bodyMesh = ctx.bodyMesh;

        // Inclusion tolerance: the focus cell straddles the meridian cut
        // (centroid distance ~0), so a small positive slack keeps it on the
        // cliff despite float error.
        this.#eps = this.#layerModel.layerRadii[0] * 1e-3;

        this.sliceGroup = new THREE.Group();
        this.sliceGroup.visible = false;
        ctx.scene.add(this.sliceGroup);

        // The selectable atmosphere shell must be pickable (its cells stay in
        // capMeshes) but must NOT draw a persistent blue box — only the hover
        // wireframe should appear. So render it colour-less and depth-neutral:
        // the geometry still exists for raycasting, but nothing is painted.
        this.#atmospherePickMaterial = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
        });

        this.#fadeDur = Math.max(0.001, (ctx.fadeMs ?? 260) / 1000);
        this.#durUniform.value = this.#fadeDur;
    }

    // Resource mode: hide the whole base body, show the rebuilt slice group,
    // and clip the (still full) core sphere to the kept half.
    enter()
    {
        this.#bodyMesh.hideAll();
        this.sliceGroup.visible = true;

        this.#bodyMesh.core.material.clippingPlanes = [this.#clip.plane];
        this.#bodyMesh.core.material.needsUpdate = true;

        this.#lastKeys = null;
        this.#lastByDepth = null;
        this.#fading.clear();
        this.#disposeAll();
        this.#lastSig = null; // force a rebuild on the next updateCut
    }

    exit()
    {
        this.sliceGroup.visible = false;
        this.#fading.clear();
        this.#disposeAll();

        this.#bodyMesh.core.material.clippingPlanes = [];
        this.#bodyMesh.core.material.needsUpdate = true;

        this.#bodyMesh.restoreView();
        this.#lastSig = null;
    }

    clearCaps()
    {
        this.#disposeAll();
    }

    // The rendered geometry depends only on WHICH cells are included, so the
    // rebuild is keyed on a membership signature — a pan along the wall (same
    // set) never rebuilds; only advancing the cut (set grows/shrinks) or the
    // transition sweep does. Per-frame membership collection is O(cells) dot
    // products with no geometry work, so it stays cheap.
    //
    // On a steady advance the reveal is animated per-cell: shared cells stay in
    // the persistent opaque buckets, newly included cells fade 0→1 and leaving
    // cells fade 1→0, each on its own clock (see tick()). During the transition
    // fly-through (slab=true) the far cull is disabled and the set changes every
    // frame, so it rebuilds directly with no fade.
    build(slab = false)
    {
        const plane = this.#clip.plane;
        const n = plane.normal;
        const k = plane.constant;

        const inc = this.#collect(n, k);

        if (inc.sig === this.#lastSig) return;

        this.#lastSig = inc.sig;

        // Hard (non-fade) rebuild during the transition sweep or when the fade
        // is disabled; otherwise the whole revealed set would fade at once.
        if (slab || this.#fadeDur <= 0.001)
        {
            this.#fading.clear();
            this.#clearFadeMeshes();
            this.#syncOpaque(inc.byDepth);
            this.#rebuildStaticTransient(inc.atmo, n, k);
            this.#lastKeys = inc.keys;
            this.#lastByDepth = inc.byDepth;
            this.#refreshCapMeshes();

            return;
        }

        const now = this.#clock;
        const prev = this.#lastKeys ?? new Set();

        // Added cells (in the new set, not the previous) start fading in.
        for (let d = 0; d < inc.byDepth.length; d++)
        {
            for (const cell of inc.byDepth[d])
            {
                const key = `${d}:${cell.cellIndex}`;

                if (!prev.has(key)) this.#startFade(key, cell, d, 1, now);
            }
        }

        // Removed cells (in the previous set, not the new) start fading out.
        if (this.#lastByDepth)
        {
            for (let d = 0; d < this.#lastByDepth.length; d++)
            {
                for (const cell of this.#lastByDepth[d])
                {
                    const key = `${d}:${cell.cellIndex}`;

                    if (!inc.keys.has(key)) this.#startFade(key, cell, d, -1, now);
                }
            }
        }

        this.#lastKeys = inc.keys;
        this.#lastByDepth = inc.byDepth;

        // Opaque = included cells that are not currently fading IN.
        this.#syncOpaque(this.#opaqueSet(inc.byDepth));
        this.#rebuildFadeMeshes();
        this.#rebuildStaticTransient(inc.atmo, n, k);
        this.#refreshCapMeshes();
    }

    // Register (or re-target) a per-cell fade. Re-targeting a cell that is
    // already fading the other way flips it while preserving its current alpha,
    // so a cell that reappears mid-fade never snaps.
    #startFade(key, cell, depth, dir, now)
    {
        const existing = this.#fading.get(key);

        if (existing)
        {
            if (existing.dir === dir) return;

            const p = Math.min(1, Math.max(0, (now - existing.t0) / this.#fadeDur));
            const alpha = existing.dir < 0 ? 1 - p : p;
            const targetP = dir > 0 ? alpha : 1 - alpha;
            existing.dir = dir;
            existing.t0 = now - targetP * this.#fadeDur;

            return;
        }

        this.#fading.set(key, { cell, depth, dir, t0: now });
    }

    // Included cells minus the ones still fading IN (those live in the fade
    // meshes until their reveal completes).
    #opaqueSet(byDepth)
    {
        const out = [];

        for (let d = 0; d < byDepth.length; d++)
        {
            const arr = [];

            for (const cell of byDepth[d])
            {
                const f = this.#fading.get(`${d}:${cell.cellIndex}`);

                if (f && f.dir > 0) continue;

                arr.push(cell);
            }

            out[d] = arr;
        }

        return out;
    }

    // Advance the per-cell reveal fade; called once per frame from the animate
    // loop. Only the global uTime uniform updates each frame — the fade meshes
    // are rebuilt solely when a fade completes (a cell folds into opaque or a
    // leaving cell is dropped).
    tick(dt)
    {
        this.#clock += dt;
        this.#timeUniform.value = this.#clock;

        if (this.#fading.size === 0) return;

        let changed = false;

        for (const [key, f] of this.#fading)
        {
            if (this.#clock - f.t0 >= this.#fadeDur)
            {
                this.#fading.delete(key);
                changed = true;
            }
        }

        if (!changed) return;

        this.#syncOpaque(this.#opaqueSet(this.#lastByDepth ?? []));
        this.#rebuildFadeMeshes();
        this.#refreshCapMeshes();
    }

    // Gather the included cells (per depth + atmosphere) and a cheap membership
    // signature in one pass.
    #collect(n, k)
    {
        const maxDepth = this.#layerModel.maxDepth;
        const byDepth = [];
        const keys = new Set();
        let hash = 0;
        let count = 0;

        for (let d = 0; d < maxDepth; d++)
        {
            const arr = [];

            for (const cell of this.#cellGrid.cellsByDepth[d])
            {
                if (!this.#included(cell, n, k)) continue;

                arr.push(cell);
                keys.add(`${d}:${cell.cellIndex}`);
                count++;
                hash = (Math.imul(hash, 31) + cell.cellIndex * (d + 1)) >>> 0;
            }

            byDepth[d] = arr;
        }

        const atmo = [];

        for (const cell of this.#cellGrid.atmosphereCells)
        {
            if (this.#included(cell, n, k)) atmo.push(cell);
        }

        return { byDepth, atmo, keys, sig: `${count}:${hash}` };
    }

    // Incrementally reconcile the persistent opaque buckets to `byDepth`: only
    // buckets whose cell membership changed are disposed + rebuilt; unchanged
    // buckets are kept (no dispose, no GPU re-upload). This is what keeps a
    // column crossing cheap — the added/removed cells touch ≤1–2 buckets.
    #syncOpaque(byDepth)
    {
        const maxDepth = this.#layerModel.maxDepth;
        const desired = new Map(); // key → { depth, cells }

        for (let d = 0; d < maxDepth; d++)
        {
            for (const cell of byDepth[d])
            {
                const key = `${d}:${this.#bucketKey(cell)}`;
                let e = desired.get(key);

                if (!e)
                {
                    e = { depth: d, cells: [] };
                    desired.set(key, e);
                }

                e.cells.push(cell);
            }
        }

        for (const [key, entry] of this.#opaqueBuckets)
        {
            if (!desired.has(key)) this.#disposeBucket(key, entry);
        }

        for (const [key, e] of desired)
        {
            const sig = this.#bucketSig(e.cells);
            const existing = this.#opaqueBuckets.get(key);

            if (existing && existing.sig === sig) continue;

            if (existing) this.#disposeBucket(key, existing);

            const mesh = this.#buildBucketMesh(e.cells, e.depth);
            this.sliceGroup.add(mesh);
            this.#opaqueBuckets.set(key, { mesh, sig });
        }
    }

    #disposeBucket(key, entry)
    {
        this.sliceGroup.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        this.#opaqueBuckets.delete(key);
    }

    #bucketSig(cells)
    {
        let h = 0;

        for (const c of cells) h = (Math.imul(h, 31) + c.cellIndex) >>> 0;

        return `${cells.length}:${h}`;
    }

    #buildBucketMesh(cells, depth)
    {
        const positions = [];
        const normals = [];
        const indices = [];
        const faceToCell = [];

        for (const cell of cells)
        {
            const triStart = indices.length / 3;
            this.#geometryFactory.appendCell(cell, positions, normals, indices);

            for (let t = triStart; t < indices.length / 3; t++)
            {
                faceToCell.push(cell);
            }
        }

        const mesh = this.#mesh(positions, normals, indices, this.#materials.depthMaterials[depth]);
        mesh.userData.faceToCell = faceToCell;

        return mesh;
    }

    // Coarse lon/lat sector key so nearby cells share a frustum-cullable mesh.
    #bucketKey(cell)
    {
        const AZ = 8;
        const EL = 4;
        const lonSector = Math.min(AZ - 1, Math.floor((((cell.lon % 360) + 360) % 360) / 360 * AZ));
        const latSector = Math.min(EL - 1, Math.floor((cell.lat + 90) / 180 * EL));

        return latSector * AZ + lonSector;
    }

    #rebuildStaticTransient(atmo, n, k)
    {
        this.#clearStaticTransient();
        this.#emitAtmosphere(atmo);
        this.#emitCoreDisc(n, k);
    }

    // Rebuild the per-cell reveal-fade meshes from the current #fading registry
    // (one merged mesh per depth). Each vertex carries the cell's absolute fade
    // start time `aT0` and direction `aDir`; a single global uTime uniform then
    // animates every in-flight cell independently (see #fadeMaterial / tick()).
    #rebuildFadeMeshes()
    {
        this.#clearFadeMeshes();

        if (this.#fading.size === 0) return;

        const byDepth = new Map();

        for (const f of this.#fading.values())
        {
            let list = byDepth.get(f.depth);

            if (!list)
            {
                list = [];
                byDepth.set(f.depth, list);
            }

            list.push(f);
        }

        for (const [depth, list] of byDepth) this.#emitFadeMesh(list, depth);
    }

    #emitFadeMesh(list, depth)
    {
        const positions = [];
        const normals = [];
        const indices = [];
        const startAttr = [];
        const dirAttr = [];
        const faceToCell = [];

        for (const f of list)
        {
            const vStart = positions.length / 3;
            const triStart = indices.length / 3;
            this.#geometryFactory.appendCell(f.cell, positions, normals, indices);

            for (let v = vStart; v < positions.length / 3; v++)
            {
                startAttr.push(f.t0);
                dirAttr.push(f.dir);
            }

            for (let t = triStart; t < indices.length / 3; t++)
            {
                faceToCell.push(f.cell);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('aT0', new THREE.Float32BufferAttribute(startAttr, 1));
        geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dirAttr, 1));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, this.#fadeMaterial(depth));
        mesh.userData.faceToCell = faceToCell;

        this.sliceGroup.add(mesh);
        this.#fadeMeshList.push(mesh);
    }

    // An order-INDEPENDENT-transparency clone of the lit depth material whose
    // per-vertex alpha ramps from the cell's absolute reveal time `aT0` over
    // `uDur` seconds, driven by the shared uTime uniform. aDir flips the ramp
    // for leaving cells. Uses alphaHash (stochastic dithered alpha that WRITES
    // depth) instead of blended transparency, so overlapping staircase cells
    // resolve through the depth buffer and never flicker by draw order.
    #fadeMaterial(depth)
    {
        if (this.#fadeMaterials[depth]) return this.#fadeMaterials[depth];

        const mat = this.#materials.depthMaterials[depth].clone();
        mat.alphaHash = true;
        mat.depthWrite = true;
        // Distinct program from the opaque depth material in the shader cache.
        mat.customProgramCacheKey = () => 'cellfade2';

        const uTime = this.#timeUniform;
        const uDur = this.#durUniform;

        mat.onBeforeCompile = (shader) =>
        {
            shader.uniforms.uTime = uTime;
            shader.uniforms.uDur = uDur;

            shader.vertexShader = 'attribute float aT0;\nattribute float aDir;\nuniform float uTime;\nuniform float uDur;\nvarying float vFadeA;\n'
                + shader.vertexShader.replace(
                    'void main() {',
                    'void main() {\n  float _p = clamp((uTime - aT0) / max(uDur, 0.0001), 0.0, 1.0);\n  vFadeA = (aDir < 0.0) ? (1.0 - _p) : _p;',
                );

            shader.fragmentShader = 'varying float vFadeA;\n'
                + shader.fragmentShader.replace(
                    'vec4 diffuseColor = vec4( diffuse, opacity );',
                    'vec4 diffuseColor = vec4( diffuse, opacity * clamp(vFadeA, 0.0, 1.0) );',
                );
        };

        mat.needsUpdate = true;
        this.#fadeMaterials[depth] = mat;

        return mat;
    }

    #emitAtmosphere(cells)
    {
        const positions = [];
        const normals = [];
        const indices = [];
        const faceToCell = [];

        for (const cell of cells)
        {
            const triStart = indices.length / 3;
            this.#geometryFactory.appendCell(cell, positions, normals, indices);

            for (let t = triStart; t < indices.length / 3; t++)
            {
                faceToCell.push(cell);
            }
        }

        if (positions.length === 0) return;

        const mesh = this.#mesh(positions, normals, indices, this.#atmospherePickMaterial);
        mesh.userData.faceToCell = faceToCell;
        this.sliceGroup.add(mesh);
        this.#staticTransient.push(mesh);
    }

    // Keep a cell iff its centroid is on the kept (+normal) half of the cut, so
    // the whole near hemisphere (full surface + full-depth crust) is included
    // and the cliff wall + surface rim are a staircase of complete cells.
    #included(cell, n, k)
    {
        const c = this.#centroid(cell);

        return n.x * c.x + n.y * c.y + n.z * c.z + k >= -this.#eps;
    }

    #centroid(cell)
    {
        if (cell.sliceCentroid) return cell.sliceCentroid;

        const c = new THREE.Vector3();
        for (const p of cell.corners) c.add(p);
        c.multiplyScalar(1 / cell.corners.length);
        cell.sliceCentroid = c;

        return c;
    }

    #mesh(positions, normals, indices, material)
    {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        return new THREE.Mesh(geo, material);
    }

    // The solid cross-section that backs the slice wall and blocks see-through.
    // The cut plane passes near the body centre, so its intersection with the
    // concentric spherical layer shells is a set of concentric annuli (one per
    // crust layer) plus a full core disc. Each is drawn flat on the plane in
    // that layer's colour, so the far side (culled) and empty space behind the
    // wall are fully occluded, and the disc is concentric + flush with the
    // whole-cell staircase (the cells simply protrude toward the camera in
    // front of it). The full core sphere is still GPU-clipped to the kept half;
    // this innermost disc is its cut face.
    // The core's flat cut face: a solid full disc filling the GPU-clipped core
    // sphere's opening at the cut plane. The crust itself is a solid stack of
    // whole cells (all depths) over the kept hemisphere, so no layered backing
    // is needed — the whole cells read as the chunky staircase at the slice.
    #emitCoreDisc(n, k)
    {
        const coreR = this.#layerModel.coreRadius;
        const v = coreR * coreR - k * k;

        if (v <= 1e-8) return;

        const discR = Math.sqrt(v);
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(discR, 96),
            this.#materials.coreCapMaterial,
        );
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        disc.position.copy(n).multiplyScalar(-k);
        this.sliceGroup.add(disc);
        this.#staticTransient.push(disc);
    }

    // Rebuild the pick list from the CURRENT meshes (opaque buckets + any
    // pickable transient meshes). Called after every change so raycasting never
    // sees a stale or disposed mesh.
    #refreshCapMeshes()
    {
        this.capMeshes.length = 0;

        for (const { mesh } of this.#opaqueBuckets.values()) this.capMeshes.push(mesh);

        for (const m of this.#staticTransient)
        {
            if (m.userData.faceToCell) this.capMeshes.push(m);
        }

        for (const m of this.#fadeMeshList)
        {
            if (m.userData.faceToCell) this.capMeshes.push(m);
        }
    }

    #clearFadeMeshes()
    {
        for (const m of this.#fadeMeshList)
        {
            this.sliceGroup.remove(m);
            m.geometry.dispose();
        }

        this.#fadeMeshList.length = 0;
    }

    #clearStaticTransient()
    {
        for (const m of this.#staticTransient)
        {
            this.sliceGroup.remove(m);
            m.geometry.dispose();
        }

        this.#staticTransient.length = 0;
    }

    #disposeAll()
    {
        for (const [key, entry] of this.#opaqueBuckets) this.#disposeBucket(key, entry);

        this.#opaqueBuckets.clear();
        this.#fading.clear();
        this.#clearFadeMeshes();
        this.#clearStaticTransient();

        // Safety: drop any stray children (should be none).
        for (const m of this.sliceGroup.children.slice())
        {
            this.sliceGroup.remove(m);

            if (m.geometry) m.geometry.dispose();
        }

        this.capMeshes.length = 0;
    }
}
