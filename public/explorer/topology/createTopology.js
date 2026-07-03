import { LonLatTopology } from './LonLatTopology.js';
import { GoldbergTopology } from './GoldbergTopology.js';

// ----------------------------------------------------------------------
// createTopology — the single switch that turns the `planet.cellTopology`
// config flag into a concrete CellTopology. Everything downstream depends
// only on the returned abstraction, so adding a scheme is a local change
// here plus the new topology class.
//
//   'lonlat'    — longitude/latitude grid + polar caps (default).
//   'hexsphere' — Goldberg polyhedron (hexagons + 12 pentagons, no poles).
// ----------------------------------------------------------------------
export function createTopology(physical, layerModel, behaviour, atmosphereRadius)
{
    const kind = physical.planet.cellTopology ?? 'lonlat';

    switch (kind)
    {
        case 'lonlat':
            return new LonLatTopology(physical, layerModel, behaviour, atmosphereRadius);

        case 'hexsphere':
            return new GoldbergTopology(physical, layerModel, behaviour, atmosphereRadius);

        default:
            throw new Error(`Unknown cellTopology '${kind}'`);
    }
}
