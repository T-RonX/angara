import { BodyInteractionSession } from './BodyInteractionSession.js';

// ----------------------------------------------------------------------
// BodyInteractionSessionFactory -- encapsulates the construction of
// BodyInteractionSession so ActiveBodyController does not directly
// instantiate sessions. Makes the dependency injection explicit and
// allows testing/replacement without changing the controller.
// ----------------------------------------------------------------------
export class BodyInteractionSessionFactory
{
    #state;
    #sceneContext;
    #behaviour;
    #hud;
    #pointerSource;

    constructor({ state, sceneContext, behaviour, hud, pointerSource })
    {
        this.#state = state;
        this.#sceneContext = sceneContext;
        this.#behaviour = behaviour;
        this.#hud = hud;
        this.#pointerSource = pointerSource;
    }

    create(body)
    {
        return new BodyInteractionSession({
            body,
            state: this.#state,
            sceneContext: this.#sceneContext,
            behaviour: this.#behaviour,
            hud: this.#hud,
            pointerSource: this.#pointerSource,
        });
    }
}
