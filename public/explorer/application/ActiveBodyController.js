// ----------------------------------------------------------------------
// ActiveBodyController -- manages the lifecycle of BodyInteractionSession
// instances. When the player selects a different body the old session is
// disposed and a new one is created from scratch. Shared resources (DOM
// input, HUD, scene) are injected once and reused across sessions.
// ----------------------------------------------------------------------
export class ActiveBodyController
{
    #registry;
    #state;
    #factory;
    #session = null;

    constructor(registry, state, sessionFactory)
    {
        this.#registry = registry;
        this.#state = state;
        this.#factory = sessionFactory;
    }

    get session() { return this.#session; }

    // Create the initial session for the active body (called once during init).
    createSession()
    {
        this.#disposeSession();
        this.#session = this.#factory.create(this.#registry.active);
    }

    // Switch the active body and rebuild the session. Only allowed from view
    // mode when no transition is in flight. Returns true if the switch happened.
    switchBody(index)
    {
        if (this.#state.mode !== 'view' || this.#state.transition.active)
        {
            return false;
        }

        const target = this.#registry.bodies[index];

        if (!target || target === this.#registry.active) return false;

        // Clear selection state before the old session is disposed.
        this.#state.selected = null;
        this.#state.resourceSelected = null;

        this.#registry.setActive(index);
        this.createSession();

        return true;
    }

    #disposeSession()
    {
        if (this.#session)
        {
            this.#session.dispose();
            this.#session = null;
        }
    }

    dispose()
    {
        this.#disposeSession();
    }
}
