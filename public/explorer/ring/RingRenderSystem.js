export class RingRenderSystem
{
    #registry;
    #starSystem;
    #disposed = false;

    constructor(registry, starSystem)
    {
        this.#registry = registry;
        this.#starSystem = starSystem;
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

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#registry = null;
        this.#starSystem = null;
    }
}
