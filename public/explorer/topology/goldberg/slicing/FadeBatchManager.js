import { buildMergedMesh } from './buildMergedMesh.js';
import { CELL_GEOMETRY_VARIANT } from '../../../geometry/CellGeometryFactory.js';

// Manages concurrent reveal-fade batches for the hex slice. Each membership
// change spawns one new batch (added cells fade in, removed cells fade out).
// Batches are independent: each owns its own cloned material per depth so
// concurrent batches at the same depth never fight over one shared opacity
// value. fadingInKeys counts every cell fading in across ALL active batches so
// the opaque set can exclude them until their own batch (not just any later one)
// finishes.
//
// Flow per build():
//   1. prepareUpdate()  — compute diff, register new cells in fadingInKeys
//   2. PersistentSliceMeshStore.sync() with updated fadingInKeys (caller side)
//   3. commitBatch()    — store new membership, build + push batch if changed
export class FadeBatchManager
{
    #sliceGroup;
    #materials;
    #geometryFactory;
    #profiler;
    #fadeBatches  = [];
    #fadeMeshList = [];
    #fadingInKeys = new Map();
    #fadingInWallKeys = new Map();
    #clock        = 0;

    // Public: checked by CellSliceBuilder to pick the hard-rebuild (slab) path.
    fadeDur;

    #lastKeys    = null;
    #lastByDepth = null;
    #lastWallSurface = null;
    #lastWallKeys = null;
    #cellStride = 0;

    constructor({ sliceGroup, materials, geometryFactory, fadeDur, profiler })
    {
        this.#sliceGroup      = sliceGroup;
        this.#materials       = materials;
        this.#geometryFactory = geometryFactory;
        this.#profiler        = profiler;
        this.fadeDur          = fadeDur;
    }

    get fadingInKeys() { return this.#fadingInKeys; }
    get fadingInWallKeys() { return this.#fadingInWallKeys; }
    get lastKeys()     { return this.#lastKeys; }
    get lastByDepth()  { return this.#lastByDepth; }
    get lastWallSurface() { return this.#lastWallSurface; }
    get hasFadingInSurface()
    {
        for (const key of this.#fadingInKeys.keys())
        {
            if (key < this.#cellStride) return true;
        }

        return false;
    }

    // Live list — callers iterate but must not mutate.
    get fadeMeshList() { return this.#fadeMeshList; }

    // Compute the cell diff (new vs previous membership), register newly-added
    // cells into fadingInKeys (side effect), and return diff metadata.
    // MUST be followed by persistent mesh sync and then commitBatch().
    prepareUpdate(incByDepth, incKeys, wallSurface, wallKeys, cellStride)
    {
        const startedAt = this.#profiler.now();
        this.#cellStride = cellStride;
        const prevKeys       = this.#lastKeys ?? new Set();
        const prevWallKeys   = this.#lastWallKeys ?? new Set();
        const addedByDepth   = [];
        const removedByDepth = [];
        const addedWallSurface = [];
        const removedWallSurface = [];
        const newAddedKeys   = [];
        const newAddedWallKeys = [];
        let hasAdded         = false;
        let hasRemoved       = false;

        for (let d = 0; d < incByDepth.length; d++)
        {
            const arr = [];

            for (const cell of incByDepth[d])
            {
                if (!prevKeys.has(d * cellStride + cell.cellIndex))
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
                    if (!incKeys.has(d * cellStride + cell.cellIndex))
                    {
                        arr.push(cell);
                        hasRemoved = true;
                    }
                }

                removedByDepth[d] = arr;
            }
        }

        for (const cell of wallSurface)
        {
            if (
                prevKeys.has(cell.cellIndex)
                && !prevWallKeys.has(cell.cellIndex)
            )
            {
                addedWallSurface.push(cell);
                hasAdded = true;
            }
        }

        if (this.#lastWallSurface)
        {
            for (const cell of this.#lastWallSurface)
            {
                if (
                    incKeys.has(cell.cellIndex)
                    && !wallKeys.has(cell.cellIndex)
                )
                {
                    removedWallSurface.push(cell);
                    hasRemoved = true;
                }
            }
        }

        // Register newly-added cells into fadingInKeys BEFORE the caller
        // syncs persistent meshes so the opaque set correctly excludes them.
        for (let d = 0; d < addedByDepth.length; d++)
        {
            for (const cell of addedByDepth[d])
            {
                const key = d * cellStride + cell.cellIndex;

                this.#fadingInKeys.set(key, (this.#fadingInKeys.get(key) ?? 0) + 1);
                newAddedKeys.push(key);
            }
        }

        for (const cell of addedWallSurface)
        {
            const key = cell.cellIndex;

            this.#fadingInWallKeys.set(
                key,
                (this.#fadingInWallKeys.get(key) ?? 0) + 1,
            );
            newAddedWallKeys.push(key);
        }

        let removedCount = 0;

        if (this.#profiler.enabled)
        {
            for (const cells of removedByDepth) removedCount += cells.length;
            removedCount += removedWallSurface.length;
        }

        this.#profiler.setValue('addedCells', newAddedKeys.length + newAddedWallKeys.length);
        this.#profiler.setValue('removedCells', removedCount);
        this.#profiler.setValue(
            'fadingCells',
            this.#fadingInKeys.size + this.#fadingInWallKeys.size,
        );
        this.#profiler.recordSince('fadeDiff', startedAt);

        return {
            addedByDepth,
            removedByDepth,
            addedWallSurface,
            removedWallSurface,
            newAddedKeys,
            newAddedWallKeys,
            hasAdded,
            hasRemoved,
        };
    }

    // Finalise the update: store new membership state and, if anything changed,
    // build + push one new fade batch. Must be called after prepareUpdate().
    commitBatch(incKeys, incByDepth, wallSurface, wallKeys, diff)
    {
        const startedAt = this.#profiler.now();
        this.#lastKeys    = incKeys;
        this.#lastByDepth = incByDepth;
        this.#lastWallSurface = wallSurface;
        this.#lastWallKeys = wallKeys;

        if (!diff.hasAdded && !diff.hasRemoved)
        {
            this.#profiler.setValue('activeFadeBatches', this.#fadeBatches.length);
            this.#profiler.recordSince('fadeCommit', startedAt);

            return;
        }

        const entries = this.#buildBatchMeshes(
            diff.addedByDepth,
            diff.removedByDepth,
            diff.addedWallSurface,
            diff.removedWallSurface,
        );

        this.#fadeBatches.push({
            t0: this.#clock,
            entries,
            addedKeys: diff.newAddedKeys,
            addedWallKeys: diff.newAddedWallKeys,
        });
        this.#profiler.increment('fadeBatchesCreated');
        this.#profiler.setValue('activeFadeBatches', this.#fadeBatches.length);
        this.#profiler.recordSince('fadeCommit', startedAt);
    }

    // Advance every in-flight batch by dt seconds. Returns true when at least
    // one batch completed so the caller can re-sync the opaque set and refresh
    // capMeshes.
    tick(dt)
    {
        this.#clock += dt;

        if (this.#fadeBatches.length === 0) return false;

        const activeBefore = this.#fadeBatches.length;
        let completed = false;

        for (let i = this.#fadeBatches.length - 1; i >= 0; i--)
        {
            const batch = this.#fadeBatches[i];
            const p     = Math.min(1, (this.#clock - batch.t0) / this.fadeDur);

            for (const e of batch.entries)
            {
                const opacity = e.dir > 0 ? p : (1 - p);
                e.material.opacity = opacity;

                if (e.material.uniforms?.opacity)
                {
                    e.material.uniforms.opacity.value = opacity;
                }
            }

            if (p >= 1)
            {
                this.#retireBatch(batch);
                this.#fadeBatches.splice(i, 1);
                completed = true;
            }
        }

        if (completed)
        {
            this.#profiler.increment('fadeBatchesCompleted', activeBefore - this.#fadeBatches.length);
            this.#profiler.setValue('activeFadeBatches', this.#fadeBatches.length);
            this.#profiler.setValue(
                'fadingCells',
                this.#fadingInKeys.size + this.#fadingInWallKeys.size,
            );
        }

        return completed;
    }

    // Hard-retire every in-flight batch (slab rebuild or mode exit).
    // Does NOT reset lastKeys / lastByDepth — those are cleared by reset().
    retireAll()
    {
        for (const batch of this.#fadeBatches) this.#retireBatch(batch);

        this.#fadeBatches = [];
        this.#fadingInKeys.clear();
        this.#fadingInWallKeys.clear();
        this.#profiler.setValue('activeFadeBatches', 0);
        this.#profiler.setValue('fadingCells', 0);
    }

    // Full reset for enter(): retire batches AND clear previous membership so
    // the first build() after entering always starts with a clean slate.
    reset()
    {
        this.retireAll();
        this.#lastKeys    = null;
        this.#lastByDepth = null;
        this.#lastWallSurface = null;
        this.#lastWallKeys = null;
    }

    // Full teardown — each batch's cloned materials are disposed in
    // #retireBatch so retireAll() is sufficient.
    dispose()
    {
        this.retireAll();
    }

    #retireBatch(batch)
    {
        for (const key of batch.addedKeys)
        {
            const remaining = this.#fadingInKeys.get(key) - 1;

            if (remaining === 0) this.#fadingInKeys.delete(key);
            else this.#fadingInKeys.set(key, remaining);
        }

        for (const key of batch.addedWallKeys)
        {
            const remaining = this.#fadingInWallKeys.get(key) - 1;

            if (remaining === 0) this.#fadingInWallKeys.delete(key);
            else this.#fadingInWallKeys.set(key, remaining);
        }

        for (const e of batch.entries)
        {
            this.#sliceGroup.remove(e.mesh);
            e.mesh.geometry.dispose();
            e.material.dispose();

            const idx = this.#fadeMeshList.indexOf(e.mesh);

            if (idx !== -1) this.#fadeMeshList.splice(idx, 1);
        }
    }

    #buildBatchMeshes(
        addedByDepth,
        removedByDepth,
        addedWallSurface,
        removedWallSurface,
    )
    {
        const entries = [];

        for (let d = 0; d < addedByDepth.length; d++)
        {
            if (!addedByDepth[d]?.length) continue;

            const material = this.#fadeMaterialClone(d, 0);
            const mesh     = this.#emitBatchMesh(addedByDepth[d], material);

            entries.push({ dir: 1, material, mesh });
        }

        for (let d = 0; d < removedByDepth.length; d++)
        {
            if (!removedByDepth[d]?.length) continue;

            const material = this.#fadeMaterialClone(d, 1);
            const mesh     = this.#emitBatchMesh(removedByDepth[d], material);

            entries.push({ dir: -1, material, mesh });
        }

        if (addedWallSurface.length > 0)
        {
            const material = this.#fadeMaterialClone(0, 0);
            const mesh = this.#emitBatchMesh(
                addedWallSurface,
                material,
                CELL_GEOMETRY_VARIANT.NO_OUTER,
            );

            entries.push({ dir: 1, material, mesh });
        }

        if (removedWallSurface.length > 0)
        {
            const material = this.#fadeMaterialClone(0, 1);
            const mesh = this.#emitBatchMesh(
                removedWallSurface,
                material,
                CELL_GEOMETRY_VARIANT.NO_OUTER,
            );

            entries.push({ dir: -1, material, mesh });
        }

        return entries;
    }

    #emitBatchMesh(cells, material, variant = CELL_GEOMETRY_VARIANT.FULL)
    {
        const mesh = buildMergedMesh(
            cells,
            material,
            this.#geometryFactory,
            this.#profiler,
            { variant, metricScope: 'transient' },
        );

        this.#sliceGroup.add(mesh);
        this.#fadeMeshList.push(mesh);

        return mesh;
    }

    // A plain transparent clone of the lit depth material, freshly created per
    // batch so concurrent batches at the same depth never share/overwrite one
    // opacity value. No custom shader. depthWrite stays on (matches the original
    // alphaHash approach) so overlapping staircase cells resolve correctly.
    #fadeMaterialClone(depth, initialOpacity)
    {
        const source    = this.#materials.depthMaterials[depth];
        const mat       = source.clone();
        mat.transparent = true;
        mat.depthWrite  = true;
        mat.opacity     = initialOpacity;

        if (source.uniforms?.tileDataTexture && mat.uniforms?.tileDataTexture)
        {
            mat.uniforms.tileDataTexture.value = source.uniforms.tileDataTexture.value;
        }

        if (mat.uniforms?.opacity)
        {
            mat.uniforms.opacity.value = initialOpacity;
        }

        return mat;
    }
}
