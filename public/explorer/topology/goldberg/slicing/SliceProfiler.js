const TIMING_LABELS = new Map([
    ['buildTotal', 'Build total'],
    ['membershipCollect', 'Membership collect'],
    ['opaqueFilter', 'Opaque filter'],
    ['fadeDiff', 'Fade diff'],
    ['sliceMeshSync', 'Slice mesh sync total'],
    ['surfaceIndexUpdate', 'Surface index update'],
    ['wallStreamUpdate', 'Wall/deep stream update'],
    ['coreDisc', 'Core disc rebuild'],
    ['coreSkirt', 'Core skirt rebuild'],
    ['fadeCommit', 'Fade commit/meshes'],
    ['capRefresh', 'Cap-list refresh'],
    ['fadeResync', 'Fade completion resync'],
    ['persistentStreamMergedTotal', 'Persistent stream merge total'],
    ['persistentStreamMergedSizing', 'Persistent stream array sizing'],
    ['persistentStreamMergedAssembly', 'Persistent stream array assembly'],
    ['persistentStreamMergedFinalize', 'Persistent stream finalization'],
    ['transientMergedTotal', 'Transient mesh merge total'],
    ['transientMergedSizing', 'Transient mesh array sizing'],
    ['transientMergedAssembly', 'Transient mesh array assembly'],
    ['transientMergedFinalize', 'Transient mesh finalization'],
]);

const COUNT_LABELS = new Map([
    ['cutAttempts', 'Cut attempts'],
    ['cutThrottled', 'Throttled attempts'],
    ['cutForced', 'Forced builds'],
    ['buildScans', 'Membership scans'],
    ['unchangedMembership', 'Unchanged exits'],
    ['hardRebuilds', 'Hard rebuilds'],
    ['fadingRebuilds', 'Fading rebuilds'],
    ['fadeResyncs', 'Fade resyncs'],
    ['fadeBatchesCreated', 'Fade batches created'],
    ['fadeBatchesCompleted', 'Fade batches completed'],
    ['persistentStreamMergedMeshes', 'Persistent stream merges'],
    ['persistentStreamMergedCells', 'Persistent stream merged cells'],
    ['persistentStreamMergedVertices', 'Persistent stream merged vertices'],
    ['persistentStreamMergedTriangles', 'Persistent stream merged triangles'],
    ['persistentStreamCapacityGrowths', 'Persistent stream capacity growths'],
    ['transientMergedMeshes', 'Transient merged meshes'],
    ['transientMergedCells', 'Transient merged cells'],
    ['transientMergedVertices', 'Transient merged vertices'],
    ['transientMergedTriangles', 'Transient merged triangles'],
    ['persistentMeshAllocations', 'Persistent mesh allocations'],
]);

const VALUE_LABELS = new Map([
    ['surfaceColumnsScanned', 'Last columns scanned'],
    ['surfaceColumnsKept', 'Last columns kept'],
    ['wallColumns', 'Last wall columns'],
    ['emittedCells', 'Last emitted cells'],
    ['addedCells', 'Last added cells'],
    ['removedCells', 'Last removed cells'],
    ['fadingCells', 'Fading-in cells'],
    ['activeFadeBatches', 'Active fade batches'],
    ['activePersistentMeshes', 'Active persistent meshes'],
    ['surfaceCells', 'Surface cells'],
    ['surfaceIndices', 'Surface indices'],
    ['streamedCells', 'Streamed cells'],
    ['streamedVertices', 'Streamed vertices'],
    ['streamedTriangles', 'Streamed triangles'],
]);

// Per-body, config-gated rolling diagnostics for resource slice generation.
// Samples are retained in fixed-size typed rings; display objects are allocated
// only when snapshot() is called at the HUD cadence.
export class SliceProfiler
{
    #enabled;
    #sampleWindow;
    #timings = new Map();
    #counters = new Map();
    #values = new Map();

    constructor({ enabled, sampleWindow })
    {
        this.#enabled = enabled;
        this.#sampleWindow = sampleWindow;
    }

    get enabled() { return this.#enabled; }

    now()
    {
        return this.#enabled ? performance.now() : 0;
    }

    recordTiming(name, duration)
    {
        if (!this.#enabled) return;

        let metric = this.#timings.get(name);

        if (!metric)
        {
            metric = {
                samples: new Float64Array(this.#sampleWindow),
                cursor: 0,
                count: 0,
                latest: 0,
            };
            this.#timings.set(name, metric);
        }

        metric.samples[metric.cursor] = duration;
        metric.cursor = (metric.cursor + 1) % this.#sampleWindow;
        metric.count = Math.min(this.#sampleWindow, metric.count + 1);
        metric.latest = duration;
    }

    recordSince(name, startedAt)
    {
        if (!this.#enabled) return;

        this.recordTiming(name, performance.now() - startedAt);
    }

    increment(name, amount = 1)
    {
        if (!this.#enabled) return;

        this.#counters.set(name, (this.#counters.get(name) ?? 0) + amount);
    }

    setValue(name, value)
    {
        if (!this.#enabled) return;

        this.#values.set(name, value);
    }

    snapshot()
    {
        if (!this.#enabled) return null;

        const timings = [];

        for (const [name, label] of TIMING_LABELS)
        {
            const metric = this.#timings.get(name);

            if (!metric) continue;

            let total = 0;
            let max = 0;

            for (let i = 0; i < metric.count; i++)
            {
                const sample = metric.samples[i];
                total += sample;
                max = Math.max(max, sample);
            }

            timings.push({
                label,
                latest: metric.latest,
                average: total / metric.count,
                max,
                samples: metric.count,
            });
        }

        const counts = [];

        for (const [name, label] of COUNT_LABELS)
        {
            if (this.#counters.has(name))
            {
                counts.push({ label, value: this.#counters.get(name), cumulative: true });
            }
        }

        for (const [name, label] of VALUE_LABELS)
        {
            if (this.#values.has(name))
            {
                counts.push({ label, value: this.#values.get(name), cumulative: false });
            }
        }

        return { timings, counts };
    }

    reset()
    {
        this.#timings.clear();
        this.#counters.clear();
        this.#values.clear();
    }

    dispose()
    {
        this.reset();
    }
}
