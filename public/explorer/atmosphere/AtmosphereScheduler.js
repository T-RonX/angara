// Tracks per-shell throttled render timing without per-frame allocations.
// A shell is due when at least 1000/hz ms have elapsed since its last pass;
// hz == 0 means every frame is due.
export class AtmosphereScheduler
{
    #lastRender = new Map();
    #disposed = false;

    isDue(shell, now, hz)
    {
        const interval = hz > 0 ? 1000 / hz : 0;
        const last = this.#lastRender.get(shell) ?? -Infinity;

        if (now - last >= interval)
        {
            this.#lastRender.set(shell, now);

            return true;
        }

        return false;
    }

    forget(shell)
    {
        this.#lastRender.delete(shell);
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#lastRender.clear();
    }
}
