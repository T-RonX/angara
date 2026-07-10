import { buildMergedMesh } from './buildMergedMesh.js';

// Manages concurrent reveal-fade batches for the hex slice. Each membership
// change spawns one new batch (added cells fade in, removed cells fade out).
// Batches are independent: each owns its own cloned material per depth so
// concurrent batches at the same depth never fight over one shared opacity
// value. fadingInKeys tracks every cell fading in across ALL active batches so
// the opaque set can exclude them until their own batch (not just any later one)
// finishes.
//
// Flow per build():
//   1. prepareUpdate()  — compute diff, register new cells in fadingInKeys
//   2. BucketStore.sync() with the now-updated fadingInKeys (caller side)
//   3. commitBatch()    — store new membership, build + push batch if changed
export class FadeBatchManager
{
    #sliceGroup;
    #materials;
    #geometryFactory;
    #fadeBatches  = [];
    #fadeMeshList = [];
    #fadingInKeys = new Set();
    #clock        = 0;

    // Public: checked by CellSliceBuilder to pick the hard-rebuild (slab) path.
    fadeDur;

    #lastKeys    = null;
    #lastByDepth = null;

    constructor({ sliceGroup, materials, geometryFactory, fadeDur })
    {
        this.#sliceGroup      = sliceGroup;
        this.#materials       = materials;
        this.#geometryFactory = geometryFactory;
        this.fadeDur          = fadeDur;
    }

    get fadingInKeys() { return this.#fadingInKeys; }
    get lastKeys()     { return this.#lastKeys; }
    get lastByDepth()  { return this.#lastByDepth; }

    // Live list — callers iterate but must not mutate.
    get fadeMeshList() { return this.#fadeMeshList; }

    // Compute the cell diff (new vs previous membership), register newly-added
    // cells into fadingInKeys (side effect), and return diff metadata.
    // MUST be followed by BucketStore.sync() (which reads updated fadingInKeys)
    // and then commitBatch().
    prepareUpdate(incByDepth, incKeys, cellStride)
    {
        const prevKeys       = this.#lastKeys ?? new Set();
        const addedByDepth   = [];
        const removedByDepth = [];
        const newAddedKeys   = [];
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

        // Register newly-added cells into fadingInKeys BEFORE the caller
        // calls BucketStore.sync() so the opaque set correctly excludes them.
        for (let d = 0; d < addedByDepth.length; d++)
        {
            for (const cell of addedByDepth[d])
            {
                const key = d * cellStride + cell.cellIndex;

                this.#fadingInKeys.add(key);
                newAddedKeys.push(key);
            }
        }

        return { addedByDepth, removedByDepth, newAddedKeys, hasAdded, hasRemoved };
    }

    // Finalise the update: store new membership state and, if anything changed,
    // build + push one new fade batch. Must be called after prepareUpdate().
    commitBatch(incKeys, incByDepth, diff)
    {
        this.#lastKeys    = incKeys;
        this.#lastByDepth = incByDepth;

        if (!diff.hasAdded && !diff.hasRemoved) return;

        const entries = this.#buildBatchMeshes(diff.addedByDepth, diff.removedByDepth);

        this.#fadeBatches.push({ t0: this.#clock, entries, addedKeys: diff.newAddedKeys });
    }

    // Advance every in-flight batch by dt seconds. Returns true when at least
    // one batch completed so the caller can re-sync the opaque set and refresh
    // capMeshes.
    tick(dt)
    {
        this.#clock += dt;

        if (this.#fadeBatches.length === 0) return false;

        let completed = false;

        for (let i = this.#fadeBatches.length - 1; i >= 0; i--)
        {
            const batch = this.#fadeBatches[i];
            const p     = Math.min(1, (this.#clock - batch.t0) / this.fadeDur);

            for (const e of batch.entries) e.material.opacity = e.dir > 0 ? p : (1 - p);

            if (p >= 1)
            {
                this.#retireBatch(batch);
                this.#fadeBatches.splice(i, 1);
                completed = true;
            }
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
    }

    // Full reset for enter(): retire batches AND clear previous membership so
    // the first build() after entering always starts with a clean slate.
    reset()
    {
        this.retireAll();
        this.#lastKeys    = null;
        this.#lastByDepth = null;
    }

    // Full teardown — each batch's cloned materials are disposed in
    // #retireBatch so retireAll() is sufficient.
    dispose()
    {
        this.retireAll();
    }

    #retireBatch(batch)
    {
        for (const key of batch.addedKeys) this.#fadingInKeys.delete(key);

        for (const e of batch.entries)
        {
            this.#sliceGroup.remove(e.mesh);
            e.mesh.geometry.dispose();
            e.material.dispose();

            const idx = this.#fadeMeshList.indexOf(e.mesh);

            if (idx !== -1) this.#fadeMeshList.splice(idx, 1);
        }
    }

    #buildBatchMeshes(addedByDepth, removedByDepth)
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

        return entries;
    }

    #emitBatchMesh(cells, material)
    {
        const mesh = buildMergedMesh(cells, material, this.#geometryFactory);

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
        const mat       = this.#materials.depthMaterials[depth].clone();
        mat.transparent = true;
        mat.depthWrite  = true;
        mat.opacity     = initialOpacity;

        return mat;
    }
}
