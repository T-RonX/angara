import { physical } from './config/physical.js';
import { behaviour } from './config/behaviour.js';
import { BodyExplorer } from './BodyExplorer.js';

// ----------------------------------------------------------------------
// Entry point — feed the (mock, eventually backend-sourced) physical and
// behavioural config into the BodyExplorer and start the render loop.
// ----------------------------------------------------------------------
const root = document.getElementById('scene-root');
const explorer = new BodyExplorer(physical, behaviour, root);
await explorer.init();
explorer.start();

