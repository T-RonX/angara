// ----------------------------------------------------------------------
// BodyGenService — the main-thread client for the body generation worker. It
// hides the postMessage/onmessage plumbing behind a single promise-returning
// method and multiplexes concurrent requests by id, so callers just `await`.
//
//   const service = new BodyGenService();
//   const { faces, surface } = await service.generate({ ... });
//
// One shared worker serves every body (main + companions). If the environment
// has no Worker (or module workers are unsupported), `isSupported` is false and
// callers fall back to the synchronous path — the worker is a performance
// accelerator, never a hard dependency.
// ----------------------------------------------------------------------
export class BodyGenService
{
    #worker = null;
    #pending = new Map();
    #nextId = 1;
    #supported;

    constructor()
    {
        this.#supported = typeof Worker !== 'undefined';
    }

    get isSupported() { return this.#supported; }

    #ensureWorker()
    {
        if (this.#worker) return this.#worker;

        this.#worker = new Worker(new URL('./bodyWorker.js', import.meta.url), { type: 'module' });

        this.#worker.onmessage = (e) =>
        {
            const msg = e.data;
            const entry = this.#pending.get(msg.id);

            if (!entry) return;

            this.#pending.delete(msg.id);

            if (msg.ok) entry.resolve({ faces: msg.faces, surface: msg.surface, tileData: msg.tileData });
            else        entry.reject(new Error(msg.error));
        };

        this.#worker.onerror = (err) =>
        {
            for (const entry of this.#pending.values()) entry.reject(err);

            this.#pending.clear();
            this.#worker?.terminate();
            this.#worker = null;
            this.#supported = false;
        };

        return this.#worker;
    }

    // Generate one body. `spec` = { frequency, layerFrac, coreRadius,
    // minSurface, shape, size }. Resolves to { faces, surface } typed-array
    // bundles (see GoldbergGen).
    generate(spec)
    {
        const worker = this.#ensureWorker();
        const id = this.#nextId++;

        return new Promise((resolve, reject) =>
        {
            this.#pending.set(id, { resolve, reject });

            try
            {
                worker.postMessage({ id, ...spec });
            }
            catch (error)
            {
                this.#pending.delete(id);
                this.#supported = false;
                worker.terminate();
                this.#worker = null;
                reject(error);
            }
        });
    }

    dispose()
    {
        const error = new Error('Body generation service disposed');

        for (const entry of this.#pending.values()) entry.reject(error);

        this.#pending.clear();

        if (this.#worker) this.#worker.terminate();

        this.#worker = null;
        this.#supported = false;
    }
}
