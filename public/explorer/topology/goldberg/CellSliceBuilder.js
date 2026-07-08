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
// FADE — cheap BATCH fade (not per-cell independent timing — that used an
// alphaHash custom shader with per-vertex time attributes and was very
// expensive to keep rebuilding on every throttled advance). Instead, all
// cells that change membership in one rebuild form a single fade batch per
// direction (added cells fade in, removed cells fade out), rendered with a
// plain cloned material per depth whose `.opacity` is animated directly each
// frame — no custom shader, no per-vertex attributes. If a new membership
// change arrives before the current batch finishes, the in-flight batch is
// snapped to complete first (a rare, brief pop during very fast direction
// changes) rather than stacking independent per-cell clocks.
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

    #planetRadius;
    #horizonCullEnabled;
    #horizonMarginRad;
    #horizonCulling = false;

    // Interior-cull band: deeper crust layers (depth >= 1) are only visible AT
    // the cut face (the cliff wall). Their interior cells are occluded by the
    // wall, the surface skin and their neighbours, so only cells whose centroid
    // lies within this signed distance of the cut plane are kept. Depth 0 (the
    // surface skin) and the atmosphere are always kept over the whole hemisphere
    // so the visible surface is never holed. See #included.
    #wallBandDist = Infinity;

    // Persistent opaque slice: key `${depth}:${bucket}` → { mesh, sig }.
    #opaqueBuckets = new Map();
    // Transient meshes rebuilt each change: the core cut-face disc (the
    // atmosphere pick shell is handled separately/lazily — see #atmosphereMesh).
    #staticTransient = [];
    // Transient reveal-fade meshes for all in-flight batches (see #fadeBatches).
    #fadeMeshList = [];

    // Numeric-key stride so membership keys are `depth * #cellStride + cellIndex`
    // (allocation-free numbers) instead of `${depth}:${cellIndex}` strings, which
    // churned the GC hard when rebuilt for thousands of cells every advance step.
    #cellStride = 1;

    // The atmosphere pick shell is INVISIBLE (colorWrite:false) and only used for
    // picking, which is skipped while the view moves. Rebuilding the whole
    // hemisphere every advance step was pure waste, so it is built LAZILY: each
    // build() just flags it dirty and records the cut; ensureAtmosphere() (called
    // by the picker before it raycasts) rebuilds it once, on demand.
    #atmosphereMesh = null;
    #atmosphereDirty = false;
    #lastN = new THREE.Vector3();
    #lastK = 0;

    // In-flight fade batches — a NEW list entry per membership change, each:
    // { t0, entries: [{ dir (+1 in / -1 out), material, mesh }] }. Concurrent
    // batches are supported (not just one at a time): with the drag-rebuild
    // throttle (~55ms) shorter than a typical fadeDur (hundreds of ms), a
    // continuous advance starts a new batch well before the previous one
    // finishes, so cutting the old one short on every new build would make
    // cells pop instead of fade. Each batch owns its own small (uncached)
    // material clones so concurrent batches touching the same depth never
    // fight over one shared opacity value. See build()/tick().
    #fadeBatches = [];
    #lastKeys = null;      // membership Set from the previous build
    #lastByDepth = null;   // membership cells (per depth) from the previous build
    #clock = 0;            // monotonic seconds, drives the fade
    #fadeDur = 0.26;
    // Cells (by numeric `depth * #cellStride + cellIndex` key) currently fading
    // in across ALL active batches — excluded from the opaque set until their
    // own batch finishes.
    #fadingInKeys = new Set();

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
        this.sliceGroup.matrixAutoUpdate = false;
        this.sliceGroup.updateMatrix();
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

        this.#planetRadius = ctx.planetRadius ?? this.#layerModel.layerRadii[0];
        const hc = ctx.horizonCull ?? {};
        this.#horizonCullEnabled = hc.enabled ?? false;
        this.#horizonMarginRad = (hc.marginDeg ?? 6) * Math.PI / 180;

        // Interior-cull band width, expressed in "surface cell diameters" so it
        // scales automatically with hexFrequency. A surface cell's approximate
        // diameter is 4R/sqrt(N) (N surface cells spread over the sphere). A
        // generous default (several cells) keeps the cliff wall comfortably
        // opaque with no peek-through while still dropping the vast occluded
        // interior. Set wallBandCells <= 0 to disable the cull (keep the whole
        // hemisphere at every depth, the original behaviour).
        const bandCells = ctx.wallBandCells ?? 4;
        const surfaceCount = this.#cellGrid.cellsByDepth[0]?.length ?? 1;
        const cellDiameter = 4 * this.#planetRadius / Math.sqrt(Math.max(1, surfaceCount));
        this.#wallBandDist = bandCells > 0 ? bandCells * cellDiameter : Infinity;

        // Stride larger than any cellIndex (cellIndex is a 0-based surface face
        // index, identical across depths for a stacked column).
        this.#cellStride = surfaceCount + 1;
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
        this.#fadeBatches = [];
        this.#fadingInKeys.clear();
        this.#disposeAll();
        this.#lastSig = null; // force a rebuild on the next updateCut
    }

    exit()
    {
        this.sliceGroup.visible = false;
        this.#horizonCulling = false;
        this.#fadeBatches = [];
        this.#fadingInKeys.clear();
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
    // On a steady advance the reveal is animated via one NEW fade batch per
    // rebuild (see header comment) — multiple batches can be in flight at
    // once. `#fadingInKeys` tracks every cell currently fading in across ALL
    // active batches so the opaque set always excludes them (a cell only
    // folds into the opaque buckets once ITS OWN batch finishes, not just
    // because a later rebuild happened to include it). During the transition
    // fly-through (slab=true) the far cull is disabled and the set changes
    // every frame, so it rebuilds directly with no fade.
    build(slab = false)
    {
        const plane = this.#clip.plane;
        const n = plane.normal;
        const k = plane.constant;

        const inc = this.#collect(n, k);

        if (inc.sig === this.#lastSig) return;

        this.#lastSig = inc.sig;

        // Record the cut and flag the (invisible) atmosphere pick shell dirty —
        // it is rebuilt lazily on the next pick, not here (see ensureAtmosphere).
        this.#lastN.copy(n);
        this.#lastK = k;
        this.#atmosphereDirty = true;

        const stride = this.#cellStride;

        // Hard (non-fade) rebuild during the transition sweep or when the fade
        // is disabled; otherwise the whole revealed set would fade at once.
        if (slab || this.#fadeDur <= 0.001)
        {
            this.#retireAllBatches();
            this.#syncOpaque(inc.byDepth);
            this.#rebuildCoreDisc(n, k);
            this.#lastKeys = inc.keys;
            this.#lastByDepth = inc.byDepth;
            this.#refreshCapMeshes();

            return;
        }

        const prevKeys = this.#lastKeys ?? new Set();
        const addedByDepth = [];
        const removedByDepth = [];
        const newAddedKeys = [];
        let hasAdded = false;
        let hasRemoved = false;

        for (let d = 0; d < inc.byDepth.length; d++)
        {
            const arr = [];

            for (const cell of inc.byDepth[d])
            {
                if (!prevKeys.has(d * stride + cell.cellIndex))
                {
                    arr.push(cell);
                    hasAdded = true;
                }
            }

            addedByDepth[d] = arr;
        }

        if (this.#lastByDepth)
        {
            for (let d = 0; d < this.#lastByDepth.length; d++)
            {
                const arr = [];

                for (const cell of this.#lastByDepth[d])
                {
                    if (!inc.keys.has(d * stride + cell.cellIndex))
                    {
                        arr.push(cell);
                        hasRemoved = true;
                    }
                }

                removedByDepth[d] = arr;
            }
        }

        // Register the newly-added cells as "fading in" BEFORE computing the
        // opaque set, so they (and any still-fading-in cells from earlier,
        // still-active batches) are excluded until their own batch completes.
        for (let d = 0; d < addedByDepth.length; d++)
        {
            for (const cell of addedByDepth[d])
            {
                const key = d * stride + cell.cellIndex;
                this.#fadingInKeys.add(key);
                newAddedKeys.push(key);
            }
        }

        this.#syncOpaque(this.#opaqueExcludingFadingIn(inc.byDepth));
        this.#rebuildCoreDisc(n, k);
        this.#lastKeys = inc.keys;
        this.#lastByDepth = inc.byDepth;

        if (hasAdded || hasRemoved)
        {
            const entries = this.#buildFadeBatchMeshes(addedByDepth, removedByDepth);
            this.#fadeBatches.push({ t0: this.#clock, entries, addedKeys: newAddedKeys });
        }

        this.#refreshCapMeshes();
    }

    // The opaque set is the current membership minus any cell still fading in
    // (from this build's new batch or any earlier still-active batch).
    #opaqueExcludingFadingIn(byDepth)
    {
        const out = [];

        for (let d = 0; d < byDepth.length; d++)
        {
            out[d] = byDepth[d].filter(cell => !this.#fadingInKeys.has(d * this.#cellStride + cell.cellIndex));
        }

        return out;
    }

    // Advance every in-flight fade batch; called once per frame from the
    // animate loop. Only material `.opacity` values update most frames — the
    // fade meshes themselves are rebuilt only when a batch starts or a batch
    // finishes (folding its cells into the opaque buckets).
    tick(dt)
    {
        this.#clock += dt;

        if (this.#fadeBatches.length === 0) return;

        let completed = false;

        for (let i = this.#fadeBatches.length - 1; i >= 0; i--)
        {
            const batch = this.#fadeBatches[i];
            const p = Math.min(1, (this.#clock - batch.t0) / this.#fadeDur);

            for (const e of batch.entries) e.material.opacity = e.dir > 0 ? p : (1 - p);

            if (p >= 1)
            {
                this.#retireBatch(batch);
                this.#fadeBatches.splice(i, 1);
                completed = true;
            }
        }

        if (completed && this.#lastByDepth)
        {
            this.#syncOpaque(this.#opaqueExcludingFadingIn(this.#lastByDepth));
            this.#refreshCapMeshes();
        }
    }

    // Dispose one finished batch's meshes/materials and drop its cells from
    // the "fading in" exclusion set so they can fold into the opaque buckets.
    #retireBatch(batch)
    {
        for (const key of batch.addedKeys) this.#fadingInKeys.delete(key);

        for (const e of batch.entries)
        {
            this.sliceGroup.remove(e.mesh);
            e.mesh.geometry.dispose();
            e.material.dispose();

            const idx = this.#fadeMeshList.indexOf(e.mesh);

            if (idx !== -1) this.#fadeMeshList.splice(idx, 1);
        }
    }

    // Retire every in-flight batch immediately (hard rebuild / mode exit).
    #retireAllBatches()
    {
        for (const batch of this.#fadeBatches) this.#retireBatch(batch);

        this.#fadeBatches = [];
        this.#fadingInKeys.clear();
    }

    // Gather the included crust cells (per depth) and a cheap membership
    // signature in one pass. The atmosphere is NOT scanned here — it is built
    // lazily on the next pick (see ensureAtmosphere), so it costs nothing while
    // the cut advances. Membership keys are allocation-free numbers.
    #collect(n, k)
    {
        const maxDepth = this.#layerModel.maxDepth;
        const stride = this.#cellStride;
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
                keys.add(d * stride + cell.cellIndex);
                count++;
                hash = (Math.imul(hash, 31) + cell.cellIndex * (d + 1)) >>> 0;
            }

            byDepth[d] = arr;
        }

        return { byDepth, keys, sig: `${count}:${hash}` };
    }

    // Incrementally reconcile the persistent opaque buckets to `byDepth`: only
    // buckets whose cell membership changed are disposed + rebuilt; unchanged
    // buckets are kept (no dispose, no GPU re-upload). This is what keeps a
    // column crossing cheap — the added/removed cells touch only a handful of
    // buckets instead of rebuilding the whole slice every time.
    #syncOpaque(byDepth)
    {
        const maxDepth = this.#layerModel.maxDepth;
        const desired = new Map(); // key → { depth, cells }

        for (let d = 0; d < maxDepth; d++)
        {
            for (const cell of byDepth[d])
            {
                const key = d * 1024 + this.#bucketKey(cell);
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

    #bucketKey(cell)
    {
        const AZ = 16;
        const EL = 8;
        const lonSector = Math.min(AZ - 1, Math.floor((((cell.lon % 360) + 360) % 360) / 360 * AZ));
        const latSector = Math.min(EL - 1, Math.floor((cell.lat + 90) / 180 * EL));

        return latSector * AZ + lonSector;
    }

    // The core cut-face disc is the only per-step static transient now — it is
    // VISIBLE (fills the clipped core's opening) so it must track the plane every
    // step. The atmosphere pick shell is deferred to ensureAtmosphere().
    #rebuildCoreDisc(n, k)
    {
        this.#clearStaticTransient();
        this.#emitCoreDisc(n, k);
    }

    // Rebuild the invisible atmosphere pick shell if the cut moved since it was
    // last built. Called by the picker right before it raycasts, so the whole-
    // hemisphere shell is only ever regenerated when a pick actually needs it
    // (once, after motion settles) instead of on every throttled advance step.
    ensureAtmosphere()
    {
        if (!this.#atmosphereDirty) return;

        this.#atmosphereDirty = false;

        if (this.#atmosphereMesh)
        {
            this.sliceGroup.remove(this.#atmosphereMesh);
            this.#atmosphereMesh.geometry.dispose();
            this.#atmosphereMesh = null;
        }

        const included = [];

        for (const cell of this.#cellGrid.atmosphereCells)
        {
            if (this.#included(cell, this.#lastN, this.#lastK)) included.push(cell);
        }

        this.#emitAtmosphere(included);
        this.#refreshCapMeshes();
    }

    // Build the (few) transient meshes for the current fade batch: one merged
    // Build the (few) transient meshes for one fade batch: one merged mesh
    // per depth for the added (fading-in) cells and one for the removed
    // (fading-out) cells, each with its OWN cloned material (not cached/
    // shared across batches — concurrent batches touching the same depth
    // must never fight over one shared opacity value). Returns the batch's
    // entry list; only `.opacity` changes afterward, every frame, via tick().
    #buildFadeBatchMeshes(addedByDepth, removedByDepth)
    {
        const entries = [];

        for (let d = 0; d < addedByDepth.length; d++)
        {
            if (!addedByDepth[d]?.length) continue;

            const material = this.#fadeMaterialClone(d, 0);
            const mesh = this.#emitBatchMesh(addedByDepth[d], material);
            entries.push({ dir: 1, material, mesh });
        }

        for (let d = 0; d < removedByDepth.length; d++)
        {
            if (!removedByDepth[d]?.length) continue;

            const material = this.#fadeMaterialClone(d, 1);
            const mesh = this.#emitBatchMesh(removedByDepth[d], material);
            entries.push({ dir: -1, material, mesh });
        }

        return entries;
    }

    #emitBatchMesh(cells, material)
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

        const mesh = this.#mesh(positions, normals, indices, material);
        mesh.userData.faceToCell = faceToCell;

        this.sliceGroup.add(mesh);
        this.#fadeMeshList.push(mesh);

        return mesh;
    }

    // A plain transparent clone of the lit depth material, freshly created per
    // batch (uncached — each batch owns its own material instances so
    // concurrent batches never share/overwrite one opacity value). No custom
    // shader/derivatives/per-vertex attributes: `.opacity` is just a uniform
    // updated directly every frame. `depthWrite` stays on (like the old
    // alphaHash approach) so overlapping staircase cells still resolve
    // through the depth buffer without draw-order flicker.
    #fadeMaterialClone(depth, initialOpacity)
    {
        const mat = this.#materials.depthMaterials[depth].clone();
        mat.transparent = true;
        mat.depthWrite = true;
        mat.opacity = initialOpacity;

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
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.sliceGroup.add(mesh);
        this.#atmosphereMesh = mesh;
    }

    // Membership test. A cell is on the kept (+normal) half of the cut iff its
    // signed distance to the plane s = n·centroid + k >= -eps. Depth 0 (the
    // surface skin) and the atmosphere are kept across the WHOLE kept hemisphere
    // so the visible surface is never holed. Deeper crust layers form only the
    // cliff wall (they are occluded everywhere else), so they are kept only
    // within #wallBandDist of the cut plane — this is what stops the slice from
    // materialising the huge occluded interior at high hexFrequency.
    #included(cell, n, k)
    {
        const c = this.#centroid(cell);
        const s = n.x * c.x + n.y * c.y + n.z * c.z + k;

        if (s < -this.#eps) return false;

        if (cell.depth === 0) return true;

        return s <= this.#wallBandDist;
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

        // Accelerate resource-mode picking. NOTE: the BVH is built LAZILY at
        // pick time (see CliffPicker#ensureBoundsTrees), NOT here. Building it
        // eagerly in the rebuild path tanked FPS while advancing the cut: every
        // throttled rebuild re-created changed buckets + the whole-hemisphere
        // atmosphere pick shell, and picking is SKIPPED while the view is moving
        // (HoverController bails on state.resourceMoving), so those eager trees
        // were pure waste. Lazy building defers the cost to the first pick after
        // motion settles, and persistent bucket meshes keep their tree across
        // pans.

        const mesh = new THREE.Mesh(geo, material);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        return mesh;
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
        const discGeo = new THREE.CircleGeometry(discR, 96);
        const disc = new THREE.Mesh(
            discGeo,
            this.#materials.coreCapMaterial,
        );
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        disc.position.copy(n).multiplyScalar(-k);
        disc.matrixAutoUpdate = false;
        disc.updateMatrix();
        this.sliceGroup.add(disc);
        this.#staticTransient.push(disc);
    }

    // Rebuild the pick list from the CURRENT meshes (opaque buckets + any
    // transient pick meshes / blockers). Called after every change so
    // raycasting never sees a stale or disposed mesh.
    // Per-frame horizon (occlusion) cull: hide opaque buckets that curve over
    // the planet's own horizon relative to the camera. Cheap visibility toggle
    // only — no geometry work, no membership change. Surface-preserving: each
    // bucket's own angular extent plus a configurable margin is added, so a
    // partially-visible bucket is never dropped.
    updateHorizonCull(camera)
    {
        if (!this.#horizonCullEnabled) return;

        const R = this.#planetRadius;
        const d = camera.position.length();

        // Degenerate: camera at/under the outer surface → no defined horizon.
        // Restore all buckets and bail (so a previous cull can't leave one hidden).
        if (d <= R * 1.001)
        {
            if (this.#horizonCulling)
            {
                for (const { mesh } of this.#opaqueBuckets.values()) mesh.visible = true;
                this.#horizonCulling = false;
            }

            return;
        }

        this.#horizonCulling = true;

        const horizonAngle = Math.acos(R / d);
        const v = camera.position.clone().multiplyScalar(1 / d);

        for (const { mesh } of this.#opaqueBuckets.values())
        {
            const bs = mesh.geometry.boundingSphere;

            if (!bs || bs.center.lengthSq() === 0)
            {
                mesh.visible = true;

                continue;
            }

            const dist = bs.center.length();
            const cDir = bs.center.clone().multiplyScalar(1 / dist);
            const bucketHalf = Math.asin(Math.min(1, bs.radius / dist));
            const angle = Math.acos(Math.max(-1, Math.min(1, cDir.dot(v))));

            mesh.visible = angle <= horizonAngle + bucketHalf + this.#horizonMarginRad;
        }
    }

    #refreshCapMeshes()
    {
        this.capMeshes.length = 0;

        for (const { mesh } of this.#opaqueBuckets.values()) this.capMeshes.push(mesh);

        for (const m of this.#staticTransient) this.capMeshes.push(m);

        if (this.#atmosphereMesh) this.capMeshes.push(this.#atmosphereMesh);

        for (const m of this.#fadeMeshList)
        {
            if (m.userData.faceToCell) this.capMeshes.push(m);
        }
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
        this.#retireAllBatches();
        this.#clearStaticTransient();

        if (this.#atmosphereMesh)
        {
            this.sliceGroup.remove(this.#atmosphereMesh);
            this.#atmosphereMesh.geometry.dispose();
            this.#atmosphereMesh = null;
        }

        this.#atmosphereDirty = false;

        // Safety: drop any stray children (should be none).
        for (const m of this.sliceGroup.children.slice())
        {
            this.sliceGroup.remove(m);

            if (m.geometry) m.geometry.dispose();
        }

        this.capMeshes.length = 0;
    }
}
