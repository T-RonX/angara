// Opt-in rolling-average profiler for CellSliceBuilder.build() sub-phase
// timings. Activated by behaviour.debug.profileSlice; off by default so the
// probe calls add no measurable overhead in production (branch on #enabled).
export class SliceProfiler
{
    #enabled;
    #every;
    #acc = { total: 0, collect: 0, sync: 0, buckets: 0, n: 0 };

    constructor({ enabled, every })
    {
        this.#enabled = enabled ?? false;
        this.#every   = Math.max(1, every ?? 30);
    }

    get enabled() { return this.#enabled; }

    // Returns a timestamp (ms) when enabled, 0 otherwise. Call once at the
    // start of build() to capture t0.
    begin()
    {
        return this.#enabled ? performance.now() : 0;
    }

    // Returns a timestamp (ms) when enabled, 0 otherwise. Call after collect()
    // to capture tCollect.
    mark()
    {
        return this.#enabled ? performance.now() : 0;
    }

    // Accumulate one rebuild's timings and log a rolling average every
    // #every rebuilds. bucketsRebuilt comes from BucketStore.bucketsRebuilt.
    record(t0, tCollect, bucketsRebuilt)
    {
        if (!this.#enabled) return;

        const end = performance.now();
        const a   = this.#acc;

        a.total   += end - t0;
        a.collect += tCollect - t0;
        a.sync    += end - tCollect;
        a.buckets += bucketsRebuilt;
        a.n++;

        if (a.n < this.#every) return;

        const n = a.n;

        console.log(
            `[slice] rebuild avg over ${n}: total ${(a.total / n).toFixed(2)}ms `
            + `(collect ${(a.collect / n).toFixed(2)}ms, geom ${(a.sync / n).toFixed(2)}ms, `
            + `${(a.buckets / n).toFixed(1)} buckets/rebuild)`,
        );

        a.total = a.collect = a.sync = a.buckets = a.n = 0;
    }

    dispose() {}
}
