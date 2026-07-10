import { ExplorerApplication } from './application/ExplorerApplication.js';

// ----------------------------------------------------------------------
// BodyExplorer — thin public facade. Construction, lifecycle and the
// render loop are owned by ExplorerApplication; this class exists only
// so index.js (the composition root) has a stable, minimal API:
//   new BodyExplorer(physical, behaviour, root)
//   await explorer.init();
//   explorer.start();
//   explorer.dispose();
// ----------------------------------------------------------------------
export class BodyExplorer
{
    #app;

    constructor(physical, behaviour, rootElement)
    {
        this.#app = new ExplorerApplication(physical, behaviour, rootElement);
    }

    async init()
    {
        await this.#app.init();

        return this;
    }

    start()
    {
        this.#app.start();
    }

    dispose()
    {
        this.#app.dispose();
    }
}
