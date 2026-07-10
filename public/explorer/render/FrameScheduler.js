// ----------------------------------------------------------------------
// FrameScheduler — owns the requestAnimationFrame loop and the window
// resize listener. The BodyExplorer facade no longer touches RAF or
// resize directly; this class is the single lifecycle owner.
//
// Call start() to begin, dispose() to stop. Both are idempotent.
// ----------------------------------------------------------------------
export class FrameScheduler
{
    #frameCallback;
    #resizeCallback;
    #lastT = performance.now();
    #rafId = null;
    #resizeHandler;
    #disposed = false;

    constructor(frameCallback, resizeCallback)
    {
        this.#frameCallback = frameCallback;
        this.#resizeCallback = resizeCallback;

        this.#resizeHandler = () => this.#resizeCallback();
        window.addEventListener('resize', this.#resizeHandler);
    }

    start()
    {
        if (this.#disposed || this.#rafId !== null) return;

        this.#tick();
    }

    #tick()
    {
        this.#rafId = requestAnimationFrame(() => this.#tick());

        const now = performance.now();
        const dt = Math.min(0.1, (now - this.#lastT) / 1000);
        this.#lastT = now;

        this.#frameCallback(dt, now);
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);

        window.removeEventListener('resize', this.#resizeHandler);
    }
}
