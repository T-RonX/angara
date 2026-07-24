import { createPhysical } from './config/physical.js';
import { behaviour } from './config/behaviour.js';
import { validateConfigs } from './config/ConfigValidator.js';
import { installBvh } from './core/BvhSetup.js';
import { BodyExplorer } from './BodyExplorer.js';

// ----------------------------------------------------------------------
// Composition root — validate configs BEFORE any THREE resources are
// allocated, then install BVH acceleration and boot the explorer.
// Dependencies are injected through the constructor; no service locator
// or global event bus.
// ----------------------------------------------------------------------
const seedPayload = JSON.parse(document.getElementById('body-seeds')?.textContent ?? 'null');
const physical = createPhysical(seedPayload);

validateConfigs(physical, behaviour);

// BVH patching must run before any BufferGeometry is created (it extends
// the prototype), so it fires between validation and construction.
installBvh();

const root = document.getElementById('scene-root');
const explorer = new BodyExplorer(physical, behaviour, root);

(async () =>
{
    await explorer.init();
    explorer.start();
})();
