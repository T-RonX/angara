import * as THREE from 'three';
import { MembershipCollector }    from './slicing/MembershipCollector.js';
import { PersistentSliceMeshStore } from './slicing/PersistentSliceMeshStore.js';
import { FadeBatchManager }       from './slicing/FadeBatchManager.js';
import { AtmospherePickRenderer } from './slicing/AtmospherePickRenderer.js';
import { CoreDiscRenderer }       from './slicing/CoreDiscRenderer.js';
import { CoreSkirtRenderer }      from './slicing/CoreSkirtRenderer.js';

// ----------------------------------------------------------------------
// CellSliceBuilder — the hexsphere SliceBuilder. Unlike the lon/lat CapBuilder
// (which GPU-clips the body with a plane and closes the sliced cells with flat
// cross-section caps), the hexsphere keeps WHOLE cells: a cell is included in
// the slice iff any surface corner is on the kept (+normal) half of the cut, so
// the cut never carves through a cell. The near-hemisphere surface plus a
// contiguous deep stack in the cliff wall band are kept, so the wall and rim
// remain a staircase of complete hexagon / pentagon cells.
//
// The kept cells are rebuilt into lit meshes reusing the body's FrontSide
// depthMaterials (coincident interior walls of touching cells cull to a single
// face, so no z-fighting; the cut-facing side faces of the boundary cells point
// toward the camera and read as the solid cliff). Each mesh carries a
// faceIndex -> cell table so CliffPicker keeps working.
//
// PERF -- the opaque surface is one immutable vertex atlas whose dynamic index
// selects whole cells. The cliff is one retained full-prism stream per depth.
// Movement mutates only retained buffers and picking maps.
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
//   PersistentSliceMeshStore -- indexed surface atlas + retained depth streams
//   FadeBatchManager       -- concurrent fade batches, fadingInKeys, clock
//   AtmospherePickRenderer -- lazy invisible atmosphere pick shell
//   CoreDiscRenderer       -- core cut-face disc (rebuilt every step)
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
    #lastCount = -1;
    #lastHash = -1;
    #disposed = false;
    #fadesEnabled;

    #collector;
    #meshStore;
    #fadeMgr;
    #atmPick;
    #coreDisc;
    #coreSkirt;
    #profiler;

    constructor(ctx)
    {
        const layerModel      = ctx.layerModel;
        const cellGrid        = ctx.cellGrid;
        const geometryFactory = ctx.geometryFactory;
        const materials       = ctx.materials;

        this.#clip     = ctx.clip;
        this.#bodyMesh = ctx.bodyMesh;
        this.#profiler = ctx.profiler;

        // Inclusion tolerance: the focus cell straddles the meridian cut
        // (centroid distance ~0), so a small positive slack keeps it on the
        // cliff despite float error.
        const eps = layerModel.layerRadii[0] * 1e-3;

        const bodyRadius = ctx.bodyRadius ?? layerModel.layerRadii[0];

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
        this.#fadesEnabled = (ctx.fadeMs ?? 260) > 0.001;

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
            profiler: this.#profiler,
        });

        this.#meshStore = new PersistentSliceMeshStore({
            sliceGroup: this.sliceGroup,
            materials,
            geometryFactory,
            cellsByDepth: cellGrid.cellsByDepth,
            profiler: this.#profiler,
        });

        this.#fadeMgr = new FadeBatchManager({
            sliceGroup: this.sliceGroup,
            materials,
            geometryFactory,
            fadeDur,
            profiler: this.#profiler,
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

        this.#coreSkirt = new CoreSkirtRenderer({
            sliceGroup: this.sliceGroup,
            layerModel,
            materials,
            stretch: ctx.skirtStretch ?? 0.4,
        });

    }

    // Resource mode: hide the whole base body, show the rebuilt slice group,
    // and clip the (still full) core sphere to the kept half.
    enter()
    {
        this.#ensureInitialized();
        this.#bodyMesh.hideAll();
        this.sliceGroup.visible = true;

        this.#bodyMesh.core.material.clippingPlanes = [this.#clip.worldPlane];
        this.#bodyMesh.core.material.needsUpdate = true;

        this.#fadeMgr.reset();
        this.#clearAll();
        this.#lastCount = -1; // force a rebuild on the next updateCut
        this.#lastHash = -1;
    }

    exit()
    {
        this.sliceGroup.visible = false;
        this.#fadeMgr.retireAll();
        this.#clearAll();

        this.#bodyMesh.core.material.clippingPlanes = [];
        this.#bodyMesh.core.material.needsUpdate = true;

        this.#bodyMesh.restoreView();
        this.#lastCount = -1;
        this.#lastHash = -1;
    }

    clearCaps()
    {
        this.#clearAll();
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
    // folds into persistent meshes once ITS OWN batch finishes). During the
    // transition fly-through (slab=true) the set changes every frame, so it
    // rebuilds directly with no fade.
    build(slab = false)
    {
        this.#ensureInitialized();

        const startedAt = this.#profiler.now();
        this.#profiler.increment('buildScans');

        const plane = this.#clip.plane;
        const n     = plane.normal;
        const k     = plane.constant;

        const inc = this.#collector.collect(n, k, this.#fadesEnabled);

        if (inc.count === this.#lastCount && inc.hash === this.#lastHash)
        {
            this.#profiler.increment('unchangedMembership');
            this.#profiler.recordSince('buildTotal', startedAt);

            return;
        }

        this.#lastCount = inc.count;
        this.#lastHash = inc.hash;

        // Record the cut and flag the (invisible) atmosphere pick shell dirty --
        // it is rebuilt lazily on the next pick, not here (see ensureAtmosphere).
        this.#atmPick.markDirty(n, k);

        // Hard (non-fade) rebuild during the transition sweep or when the fade
        // is disabled; otherwise the whole revealed set would fade at once.
        if (slab || !this.#fadesEnabled)
        {
            this.#profiler.increment('hardRebuilds');
            this.#fadeMgr.retireAll();
            this.#meshStore.sync(inc.byDepth, inc.wallSurface);

            let phaseStartedAt = this.#profiler.now();
            this.#coreDisc.rebuild(n, k);
            this.#profiler.recordSince('coreDisc', phaseStartedAt);

            phaseStartedAt = this.#profiler.now();
            this.#coreSkirt.rebuild(inc.byDepth[inc.byDepth.length - 1]);
            this.#profiler.recordSince('coreSkirt', phaseStartedAt);

            if (this.#fadesEnabled)
            {
                // A slab build is hard, but its membership seeds the next
                // enabled-fade diff once the transition completes.
                this.#fadeMgr.commitBatch(
                    inc.keys,
                    inc.byDepth,
                    inc.wallSurface,
                    inc.wallKeys,
                    { hasAdded: false, hasRemoved: false },
                );
            }

            this.#refreshCapMeshes();
            this.#profiler.recordSince('buildTotal', startedAt);

            return;
        }

        this.#profiler.increment('fadingRebuilds');

        // 1. Compute diff and register new fading-in cells (side effect inside
        //    prepareUpdate updates fadingInKeys before step 2).
        const diff = this.#fadeMgr.prepareUpdate(
            inc.byDepth,
            inc.keys,
            inc.wallSurface,
            inc.wallKeys,
            this.#collector.cellStride,
        );

        // 2. Sync opaque using the now-updated fadingInKeys so fading-in cells
        //    are excluded from the persistent meshes.
        const opaque = this.#collector.opaqueExcludingFadingIn(
            inc.byDepth,
            inc.wallSurface,
            this.#fadeMgr.fadingInKeys,
            this.#fadeMgr.fadingInWallKeys,
        );
        this.#meshStore.sync(opaque.byDepth, opaque.wallSurface);

        // 3. Rebuild core disc, store new membership, build fade batch.
        let phaseStartedAt = this.#profiler.now();
        this.#coreDisc.rebuild(n, k);
        this.#profiler.recordSince('coreDisc', phaseStartedAt);

        phaseStartedAt = this.#profiler.now();
        this.#coreSkirt.rebuild(inc.byDepth[inc.byDepth.length - 1]);
        this.#profiler.recordSince('coreSkirt', phaseStartedAt);

        this.#fadeMgr.commitBatch(
            inc.keys,
            inc.byDepth,
            inc.wallSurface,
            inc.wallKeys,
            diff,
        );
        this.#refreshCapMeshes();
        this.#profiler.recordSince('buildTotal', startedAt);
    }

    // Advance every in-flight fade batch; called once per frame from the
    // animate loop. Only material .opacity values update most frames -- the
    // fade meshes themselves are rebuilt only when a batch starts or finishes
    // (folding its cells into the persistent meshes). Returns true when a
    // completion changed the current pick meshes.
    tick(dt)
    {
        const completed = this.#fadeMgr.tick(dt);

        if (completed && this.#fadeMgr.lastByDepth)
        {
            const resyncStartedAt = this.#profiler.now();

            const opaque = this.#collector.opaqueExcludingFadingIn(
                this.#fadeMgr.lastByDepth,
                this.#fadeMgr.lastWallSurface,
                this.#fadeMgr.fadingInKeys,
                this.#fadeMgr.fadingInWallKeys,
            );
            this.#meshStore.sync(opaque.byDepth, opaque.wallSurface);

            this.#refreshCapMeshes();
            this.#profiler.increment('fadeResyncs');
            this.#profiler.recordSince('fadeResync', resyncStartedAt);
        }

        return completed;
    }

    // Rebuild the invisible atmosphere pick shell if the cut moved since it was
    // last built. Called by the picker right before it raycasts, so the whole-
    // hemisphere shell is only ever regenerated when a pick actually needs it
    // (once, after motion settles) instead of on every throttled advance step.
    ensureAtmosphere()
    {
        if (this.#atmPick.ensure()) this.#refreshCapMeshes();
    }

    // Appends only currently rendered slice occluders and reports whether every
    // appended geometry already has a current BVH. It never builds a tree:
    // CliffPicker remains the lazy tree owner once resource motion settles.
    collectReadyOcclusionMeshes(target)
    {
        let ready = true;
        let count = 0;

        for (const mesh of this.capMeshes)
        {
            if (!mesh.visible || mesh.userData.occlusion === false) continue;

            target.push(mesh);
            count++;

            if (!mesh.geometry?.boundsTree) ready = false;
        }

        return count > 0 && ready;
    }

    // Consolidated meshes rely on normal back-face and depth rejection.
    updateHorizonCull()
    {
    }

    // Rebuild the pick list from the CURRENT meshes (persistent + transient
    // pick meshes / blockers). Called after every change so
    // raycasting never sees a stale or disposed mesh.
    #refreshCapMeshes()
    {
        const startedAt = this.#profiler.now();
        this.capMeshes.length = 0;

        for (const mesh of this.#meshStore.activeMeshes) this.capMeshes.push(mesh);

        for (const m of this.#coreDisc.meshes) this.capMeshes.push(m);

        for (const m of this.#coreSkirt.meshes) this.capMeshes.push(m);

        const atmMesh = this.#atmPick.mesh;

        if (atmMesh) this.capMeshes.push(atmMesh);

        for (const m of this.#fadeMgr.fadeMeshList)
        {
            if (m.userData.faceToCell) this.capMeshes.push(m);
        }

        this.#profiler.recordSince('capRefresh', startedAt);
    }

    #clearAll()
    {
        this.#meshStore.clear();
        this.#fadeMgr.retireAll();
        this.#coreDisc.clear();
        this.#coreSkirt.clear();
        this.#atmPick.clearMesh();

        this.capMeshes.length = 0;
    }

    #ensureInitialized()
    {
        this.#collector.ensureInitialized();
        this.#meshStore.ensureInitialized();
    }

    // Release every GPU resource owned by this slice builder and remove the
    // slice group from the scene. Idempotent.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#clearAll();
        this.#meshStore.dispose();
        this.#fadeMgr.dispose();
        this.#coreDisc.dispose();
        this.#coreSkirt.dispose();
        this.#atmPick.dispose();
        this.sliceGroup.removeFromParent();
        this.capMeshes.length = 0;
    }
}
