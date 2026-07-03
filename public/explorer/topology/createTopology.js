import { GoldbergTopology } from './GoldbergTopology.js';

// ----------------------------------------------------------------------
// createTopology — the single switch that turns the `planet.cellTopology`
// config flag into the active CellTopology. The app currently runs the
// hexsphere only.
// ----------------------------------------------------------------------
export function createTopology(physical, layerModel, behaviour, atmosphereRadius)
{
    const kind = physical.planet.cellTopology ?? 'hexsphere';

    if (kind !== 'hexsphere')
    {
        throw new Error(`Unsupported cellTopology '${kind}'`);
    }

    return new GoldbergTopology(physical, layerModel, behaviour, atmosphereRadius);
}
