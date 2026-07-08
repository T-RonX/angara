// ----------------------------------------------------------------------
// BodyRegistry — the collection of CelestialBody instances in the scene and
// the resolver of the currently ACTIVE (selected) body. BodyExplorer's shared
// subsystems (hover, crust camera, focus, transition, input, hud) always talk
// to `registry.active`, so switching the active body (selecting a companion)
// is a single re-point here rather than a rewire across the app.
//
// For now it is seeded from a single primary body; companions are added later
// by the orbit/selection phase. Keeping it a first-class object from the start
// means that phase adds bodies without touching the orchestrator's wiring.
// ----------------------------------------------------------------------
export class BodyRegistry
{
    #bodies = [];
    #activeIndex = 0;

    add(body)
    {
        this.#bodies.push(body);

        return body;
    }

    get bodies() { return this.#bodies; }

    get active() { return this.#bodies[this.#activeIndex] ?? null; }

    get activeIndex() { return this.#activeIndex; }

    setActive(bodyOrIndex)
    {
        const index = typeof bodyOrIndex === 'number'
            ? bodyOrIndex
            : this.#bodies.indexOf(bodyOrIndex);

        if (index < 0 || index >= this.#bodies.length) return this.active;

        this.#activeIndex = index;

        return this.active;
    }
}
