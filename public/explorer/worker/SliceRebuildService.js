function defaultWorkerFactory()
{
    if (typeof Worker === 'undefined') return null;

    return new Worker(new URL('./sliceWorker.js', import.meta.url), { type: 'module' });
}

// Latest-wins client for one body's dependency-free slice worker. A request in
// flight cannot be cancelled, so it is dropped on completion when superseded;
// only one replacement is retained.
export class SliceRebuildService
{
    #workerFactory;
    #onError;
    #now;
    #worker = null;
    #supported;
    #ready = false;
    #snapshot = null;
    #active = null;
    #replacement = null;
    #nextRevision = 1;
    #disposed = false;

    constructor({
        workerFactory = null,
        onError = error => console.error('[explorer] slice worker failed', error),
        now = () => performance.now(),
    } = {})
    {
        this.#workerFactory = workerFactory ?? defaultWorkerFactory;
        this.#onError = onError;
        this.#now = now;
        this.#supported = workerFactory !== null || typeof Worker !== 'undefined';
    }

    get isSupported() { return this.#supported && !this.#disposed; }

    request(snapshot, request, callbacks = {})
    {
        if (!this.isSupported) return null;

        const entry = {
            revision: this.#nextRevision++,
            request,
            callbacks,
            requestedAt: request.measure ? this.#now() : 0,
        };

        try
        {
            this.#ensureWorker(snapshot);
        }
        catch (error)
        {
            this.#disable(error, entry);

            return null;
        }

        if (this.#active)
        {
            if (this.#replacement) this.#replacement.callbacks.onCoalesced?.(this.#replacement.revision);

            this.#replacement = entry;

            return entry.revision;
        }

        this.#active = entry;
        this.#dispatchActive();

        return entry.revision;
    }

    cancelPending()
    {
        this.#active = null;
        this.#replacement = null;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.cancelPending();
        this.#worker?.terminate();
        this.#worker = null;
        this.#supported = false;
    }

    #ensureWorker(snapshot)
    {
        if (this.#worker)
        {
            if (snapshot !== this.#snapshot)
            {
                throw new Error('Slice worker cannot be reinitialized with a different snapshot');
            }

            return;
        }

        const worker = this.#workerFactory();

        if (!worker)
        {
            throw new Error('Module workers are not supported');
        }

        this.#snapshot = snapshot;
        this.#worker = worker;
        worker.onmessage = event => this.#handleMessage(event.data);
        worker.onerror = error => this.#disable(error);
        worker.postMessage({ type: 'initialize', snapshot });
    }

    #dispatchActive()
    {
        if (!this.#ready || !this.#active || !this.#worker) return;

        try
        {
            this.#worker.postMessage({
                type: 'calculate',
                revision: this.#active.revision,
                request: this.#active.request,
                measure: this.#active.request.measure === true,
            });
        }
        catch (error)
        {
            this.#disable(error);
        }
    }

    #handleMessage(message)
    {
        if (this.#disposed) return;

        if (message.type === 'initialized')
        {
            if (!message.ok)
            {
                this.#disable(new Error(message.error));

                return;
            }

            this.#ready = true;
            this.#dispatchActive();

            return;
        }

        if (message.type !== 'result') return;

        const entry = this.#active;

        if (!entry || entry.revision !== message.revision) return;

        this.#active = null;
        const superseded = this.#replacement !== null;

        if (!message.ok)
        {
            entry.callbacks.onFailure?.(new Error(message.error), entry.revision);
        }
        else if (superseded)
        {
            entry.callbacks.onStale?.(entry.revision);
        }
        else
        {
            const latencyMs = entry.request.measure ? this.#now() - entry.requestedAt : null;
            entry.callbacks.onResult?.({
                result: message.result,
                revision: entry.revision,
                latencyMs,
                calcMs: message.calcMs,
            });
        }

        if (this.#replacement)
        {
            this.#active = this.#replacement;
            this.#replacement = null;
            this.#dispatchActive();
        }
    }

    #disable(error, initialEntry = null)
    {
        if (this.#disposed) return;

        this.#onError(error);
        const entries = [initialEntry, this.#active, this.#replacement].filter(Boolean);
        this.#active = null;
        this.#replacement = null;
        this.#worker?.terminate();
        this.#worker = null;
        this.#ready = false;
        this.#supported = false;

        for (const entry of entries) entry.callbacks.onFailure?.(error, entry.revision);
    }
}
