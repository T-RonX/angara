import { buildMergedMesh } from './buildMergedMesh.js';

// Manages the persistent (depth × lon/lat sector) bucket meshes that make up
// the opaque slice. Splitting the slice into coarse sector buckets lets Three's
// frustum culler drop off-screen ones, and means a cut advance only re-uploads
// the few buckets whose cell membership actually changed — not the whole slice.
//
// Numeric bucket key: depth * 1024 + sectorIndex (allocation-free — no strings
// in the hot sync path).
export class BucketStore
{
    #sliceGroup;
    #materials;
    #geometryFactory;
    #opaqueBuckets = new Map();

    // Reset to 0 by sync(); read by SliceProfiler for the bucket/rebuild stat.
    bucketsRebuilt = 0;

    constructor({ sliceGroup, materials, geometryFactory })
    {
        this.#sliceGroup      = sliceGroup;
        this.#materials       = materials;
        this.#geometryFactory = geometryFactory;
    }

    // Expose the bucket map (read-only intent) for HorizonCuller and
    // #refreshCapMeshes in CellSliceBuilder.
    get opaqueBuckets() { return this.#opaqueBuckets; }

    // Reconcile persistent buckets to match `byDepth`. Only buckets whose
    // cell membership changed are disposed + rebuilt; unchanged ones survive.
    // Resets bucketsRebuilt at the start of each call.
    sync(byDepth)
    {
        this.bucketsRebuilt = 0;

        const desired = new Map();

        for (let d = 0; d < byDepth.length; d++)
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
            if (!desired.has(key)) this.#disposeBucketEntry(key, entry);
        }

        for (const [key, e] of desired)
        {
            const sig      = this.#bucketSig(e.cells);
            const existing = this.#opaqueBuckets.get(key);

            if (existing && existing.sig === sig) continue;

            if (existing) this.#disposeBucketEntry(key, existing);

            const mesh = buildMergedMesh(
                e.cells,
                this.#materials.depthMaterials[e.depth],
                this.#geometryFactory,
            );

            this.#sliceGroup.add(mesh);
            this.#opaqueBuckets.set(key, { mesh, sig });
            this.bucketsRebuilt++;
        }
    }

    // Dispose all bucket meshes and clear the map.
    disposeAll()
    {
        for (const [key, entry] of this.#opaqueBuckets) this.#disposeBucketEntry(key, entry);

        this.#opaqueBuckets.clear();
    }

    // Full teardown — no materials are owned here so disposeAll() is sufficient.
    dispose()
    {
        this.disposeAll();
    }

    #disposeBucketEntry(key, entry)
    {
        this.#sliceGroup.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        this.#opaqueBuckets.delete(key);
    }

    #bucketSig(cells)
    {
        let h = 0;

        for (const c of cells) h = (Math.imul(h, 31) + c.cellIndex) >>> 0;

        return `${cells.length}:${h}`;
    }

    #bucketKey(cell)
    {
        const AZ = 16;
        const EL = 8;
        const lonSector = Math.min(AZ - 1, Math.floor((((cell.lon % 360) + 360) % 360) / 360 * AZ));
        const latSector = Math.min(EL - 1, Math.floor((cell.lat + 90) / 180 * EL));

        return latSector * AZ + lonSector;
    }
}
