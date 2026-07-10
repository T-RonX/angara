import * as THREE from 'three';
import { MembershipCollector }    from './slicing/MembershipCollector.js';
import { BucketStore }            from './slicing/BucketStore.js';
import { FadeBatchManager }       from './slicing/FadeBatchManager.js';
import { AtmospherePickRenderer } from './slicing/AtmospherePickRenderer.js';
import { CoreDiscRenderer }       from './slicing/CoreDiscRenderer.js';
import { HorizonCuller }          from './slicing/HorizonCuller.js';
import { SliceProfiler }          from './slicing/SliceProfiler.js';

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
// faceIndex -> cell table so CliffPicker keeps working.
//
// PERF -- incremental, bucketed rebuild. The opaque slice is split into coarse
// lon/lat SECTOR buckets (one merged mesh per (depth, bucket)) so Three's
// frustum culling drops off-screen buckets, AND so a membership change only
// re-uploads the FEW buckets whose cell set actually changed. Persistent bucket
// meshes are kept across rebuilds; only changed buckets are disposed + rebuilt.
//
// CORE -- the full core sphere would bulge into the cut-away region toward the
// camera, so -- like the lon/lat path -- the core material is clipped to the kept
// half; its cut face is filled by a solid full disc. The crust is a solid stack
// of whole cells over the kept hemisphere, so no layered cross-section backing
// is needed.
//
// FADE -- cheap BATCH fade (not per-cell independent timing -- that used an
// alphaHash custom shader with per-vertex time attributes and was very expensive
// to keep rebuilding on every throttled advance). Instead, all cells that change
// membership in one rebuild form a single fade batch per direction (added cells
// fade in, removed cells fade out), rendered with a plain cloned material per
// depth whose .opacity is animated directly each frame. Multiple batches can be
// in flight concurrently; each owns its own material instances so they never
// fight over one shared opacity value.
//
// Responsibilities are delegated to focused sub-components under slicing/:
//   MembershipCollector    -- column-unit collect(), included(), opaqueExcluding
//   BucketStore            -- persistent (depth x sector) opaque bucket meshes
//   FadeBatchManager       -- concurrent fade batches, fadingInKeys, clock
//   AtmospherePickRenderer -- lazy invisible atmosphere pick shell
//   CoreDiscRenderer       -- core cut-face disc (rebuilt every step)
//   HorizonCuller          -- per-frame visibility cull for opaque buckets
//   SliceProfiler          -- optional rolling-average rebuild profiler
//
// SliceBuilder contract: build(slab), capMeshes[], clearCaps(), enter(), exit().
// ----------------------------------------------------------------------
export class CellSliceBuilder
{
    sliceGroup;
    capMeshes = [];

    #clip;
    #bodyMesh;
    #lastSig = null;
    #disposed = false;

    #collector;
    #bucketStore;
    #fadeMgr;
    #atmPick;
    #coreDisc;
    #horizonCuller;
    #profiler;

    constructor(ctx)
    {
        const layerModel      = ctx.layerModel;
        const cellGrid        = ctx.cellGrid;
        const geometryFactory = ctx.geometryFactory;
        const materials       = ctx.materials;

        this.#clip     = ctx.clip;
        this.#bodyMesh = ctx.bodyMesh;

        // Inclusion tolerance: the focus cell straddles the meridian cut
        // (centroid distance ~0), so a small positive slack keeps it on the
        // cliff despite float error.
        const eps = layerModel.layerRadii[0] * 1e-3;

        const bodyRadius = ctx.bodyRadius ?? ctx.planetRadius ?? layerModel.layerRadii[0];

        // Interior-cull band width, expressed in "surface cell diameters" so it
        // scales automatically with hexFrequency. A surface cell's approximate
        // diameter is 4R/sqrt(N) (N surface cells spread over the sphere). A
        // generous default (several cells) keeps the cliff wall comfortably
        // opaque with no peek-through while still dropping the vast occluded
        // interior. Set wallBandCells <= 0 to disable the cull (keep the whole
        // hemisphere at every depth, the original behaviour).
        const bandCells    = ctx.wallBandCells ?? 4;
        const surfaceCount = cellGrid.cellsByDepth[0]?.length ?? 1;
        const cellDiameter = 4 * bodyRadius / Math.sqrt(Math.max(1, surfaceCount));
        const wallBandDist = bandCells > 0 ? bandCells * cellDiameter : Infinity;

        // Stride larger than any cellIndex (cellIndex is a 0-based surface face
        // index, identical across depths for a stacked column).
        const cellStride = surfaceCount + 1;

        const fadeDur = Math.max(0.001, (ctx.fadeMs ?? 260) / 1000);
        const hc      = ctx.horizonCull ?? {};

        this.sliceGroup = new THREE.Group();
        this.sliceGroup.visible = false;
        this.sliceGroup.matrixAutoUpdate = false;
        this.sliceGroup.updateMatrix();
        ctx.bodyMesh.add(this.sliceGroup);

        this.#collector = new MembershipCollector({
            cellGrid,
            layerModel,
            eps,
            wallBandDist,
            cellStride,
        });

        this.#bucketStore = new BucketStore({
            sliceGroup: this.sliceGroup,
            materials,
            geometryFactory,
        });

        this.#fadeMgr = new FadeBatchManager({
            sliceGroup: this.sliceGroup,
            materials,
            geometryFactory,
            fadeDur,
        });

        this.#atmPick = new AtmospherePickRenderer({
            sliceGroup: this.sliceGroup,
            cellGrid,
            geometryFactory,
            collector: this.#collector,
        });

        this.#coreDisc = new CoreDiscRenderer({
            sliceGroup: this.sliceGroup,
            layerModel,
            materials,
        });

        this.#horizonCuller = new HorizonCuller({
            enabled:   hc.enabled ?? false,
            marginDeg: hc.marginDeg ?? 6,
            bodyRadius,
            bodyGroup: ctx.bodyMesh.group,
        });

        this.#profiler = new SliceProfiler({
            enabled: ctx.profileSlice ?? false,
            every:   ctx.profileEvery ?? 30,
        });
    }

    // Resource mode: hide the whole base body, show the rebuilt slice group,
    // and clip the (still full) core sphere to the kept half.
    enter()
    {
        this.#bodyMesh.hideAll();
        this.sliceGroup.visible = true;

        this.#bodyMesh.core.material.clippingPlanes = [this.#clip.worldPlane];
        this.#bodyMesh.core.material.needsUpdate = true;

        this.#fadeMgr.reset();
        this.#disposeAll();
        this.#lastSig = null; // force a rebuild on the next updateCut
    }

    exit()
    {
        this.sliceGroup.visible = false;
        this.#horizonCuller.reset();
        this.#fadeMgr.retireAll();
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
    // rebuild is keyed on a membership signature -- a pan along the wall (same
    // set) never rebuilds; only advancing the cut (set grows/shrinks) or the
    // transition sweep does. Per-frame membership collection is O(cells) dot
    // products with no geometry work, so it stays cheap.
    //
    // On a steady advance the reveal is animated via one NEW fade batch per
    // rebuild (see header comment) -- multiple batches can be in flight at
    // once. fadingInKeys tracks every cell currently fading in across ALL
    // active batches so the opaque set always excludes them (a cell only
    // folds into the opaque buckets once ITS OWN batch finishes). During the
    // transition fly-through (slab=true) the set changes every frame, so it
    // rebuilds directly with no fade.
    build(slab = false)
    {
        const plane = this.#clip.plane;
        const n     = plane.normal;
        const k     = plane.constant;

        const t0 = this.#profiler.begin();

        const inc = this.#collector.collect(n, k);

        if (inc.sig === this.#lastSig) return;

        const tCollect = this.#profiler.mark();

        this.#lastSig = inc.sig;

        // Record the cut and flag the (invisible) atmosphere pick shell dirty --
        // it is rebuilt lazily on the next pick, not here (see ensureAtmosphere).
        this.#atmPick.markDirty(n, k);

        // Hard (non-fade) rebuild during the transition sweep or when the fade
        // is disabled; otherwise the whole revealed set would fade at once.
        if (slab || this.#fadeMgr.fadeDur <= 0.001)
        {
            this.#fadeMgr.retireAll();
            this.#bucketStore.sync(inc.byDepth);
            this.#coreDisc.rebuild(n, k);
            // Store new membership so tick() can re-sync after batches complete.
            this.#fadeMgr.commitBatch(inc.keys, inc.byDepth, { hasAdded: false, hasRemoved: false });
            this.#refreshCapMeshes();
            this.#profiler.record(t0, tCollect, this.#bucketStore.bucketsRebuilt);

            return;
        }

        // 1. Compute diff and register new fading-in cells (side effect inside
        //    prepareUpdate updates fadingInKeys before step 2).
        const diff = this.#fadeMgr.prepareUpdate(
            inc.byDepth,
            inc.keys,
            this.#collector.cellStride,
        );

        // 2. Sync opaque using the now-updated fadingInKeys so fading-in cells
        //    are excluded from the persistent buckets.
        this.#bucketStore.sync(
            this.#collector.opaqueExcludingFadingIn(inc.byDepth, this.#fadeMgr.fadingInKeys),
        );

        // 3. Rebuild core disc, store new membership, build fade batch.
        this.#coreDisc.rebuild(n, k);
        this.#fadeMgr.commitBatch(inc.keys, inc.byDepth, diff);
        this.#refreshCapMeshes();
        this.#profiler.record(t0, tCollect, this.#bucketStore.bucketsRebuilt);
    }

    // Advance every in-flight fade batch; called once per frame from the
    // animate loop. Only material .opacity values update most frames -- the
    // fade meshes themselves are rebuilt only when a batch starts or finishes
    // (folding its cells into the opaque buckets).
    tick(dt)
    {
        const completed = this.#fadeMgr.tick(dt);

        if (completed && this.#fadeMgr.lastByDepth)
        {
            this.#bucketStore.sync(
                this.#collector.opaqueExcludingFadingIn(
                    this.#fadeMgr.lastByDepth,
                    this.#fadeMgr.fadingInKeys,
                ),
            );

            this.#refreshCapMeshes();
        }
    }

    // Rebuild the invisible atmosphere pick shell if the cut moved since it was
    // last built. Called by the picker right before it raycasts, so the whole-
    // hemisphere shell is only ever regenerated when a pick actually needs it
    // (once, after motion settles) instead of on every throttled advance step.
    ensureAtmosphere()
    {
        if (this.#atmPick.ensure()) this.#refreshCapMeshes();
    }

    // Per-frame horizon (occlusion) cull: hide opaque buckets that curve over
    // the planet's own horizon relative to the camera. Cheap visibility toggle
    // only -- no geometry work, no membership change. Surface-preserving: each
    // bucket's own angular extent plus a configurable margin is added, so a
    // partially-visible bucket is never dropped.
    updateHorizonCull(camera)
    {
        this.#horizonCuller.update(camera, this.#bucketStore.opaqueBuckets);
    }

    // Rebuild the pick list from the CURRENT meshes (opaque buckets + any
    // transient pick meshes / blockers). Called after every change so
    // raycasting never sees a stale or disposed mesh.
    #refreshCapMeshes()
    {
        this.capMeshes.length = 0;

        for (const { mesh } of this.#bucketStore.opaqueBuckets.values()) this.capMeshes.push(mesh);

        for (const m of this.#coreDisc.meshes) this.capMeshes.push(m);

        const atmMesh = this.#atmPick.mesh;

        if (atmMesh) this.capMeshes.push(atmMesh);

        for (const m of this.#fadeMgr.fadeMeshList)
        {
            if (m.userData.faceToCell) this.capMeshes.push(m);
        }
    }

    #disposeAll()
    {
        this.#bucketStore.disposeAll();
        this.#fadeMgr.retireAll();
        this.#coreDisc.clear();
        this.#atmPick.clearMesh();

        // Safety: drop any stray children (should be none).
        for (const m of this.sliceGroup.children.slice())
        {
            this.sliceGroup.remove(m);

            if (m.geometry) m.geometry.dispose();
        }

        this.capMeshes.length = 0;
    }

    // Release every GPU resource owned by this slice builder and remove the
    // slice group from the scene. Idempotent.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#disposeAll();
        this.sliceGroup.removeFromParent();
        this.capMeshes.length = 0;
    }
}
