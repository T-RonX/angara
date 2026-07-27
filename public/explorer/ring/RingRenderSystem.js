export class RingRenderSystem
{
    #registry;
    #starSystem;
    #disposed = false;

    constructor(registry, starSystem, nightDarkness)
    {
        this.#registry = registry;
        this.#starSystem = starSystem;
        this.setNightDarkness(nightDarkness);
    }

    update()
    {
        if (this.#disposed) return;

        const energies = this.#starSystem.energies();

        for (const body of this.#registry.bodies)
        {
            body.rings?.updateLighting(
                this.#starSystem.directions,
                this.#starSystem.colors,
                energies,
            );
        }
    }

    setNightDarkness(nightDarkness)
    {
        if (this.#disposed) return;

        for (const body of this.#registry.bodies)
        {
            body.rings?.setNightDarkness(nightDarkness);
        }
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#registry = null;
        this.#starSystem = null;
    }
}
