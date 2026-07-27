import assert from 'node:assert/strict';

import { behaviour } from '../config/behaviour.js';
import { validateConfigs } from '../config/ConfigValidator.js';
import { createPhysical } from '../config/physical.js';

const validPhysical = createSeededPhysical();
validPhysical.body.companions[0].rings = structuredClone(validPhysical.body.rings);
assert.doesNotThrow(() => validateConfigs(validPhysical, behaviour));

const invalidCases = [
    [
        physical => { physical.body.rings.textureWidth = 20000; },
        /textureWidth must be an integer between 16 and 16384/,
    ],
    [
        physical => { physical.body.rings.bands = []; },
        /bands must be non-empty/,
    ],
    [
        physical => { physical.body.rings.bands[0].color = 0x1000000; },
        /color must be a 24-bit integer/,
    ],
    [
        physical => { physical.body.rings.bands[1].innerRadius = 1.35; },
        /bands must not overlap/,
    ],
    [
        physical =>
        {
            const [first, second] = physical.body.rings.bands;
            physical.body.rings.bands[0] = second;
            physical.body.rings.bands[1] = first;
        },
        /bands must be sorted/,
    ],
    [
        physical => { physical.body.rings.bands[0].innerRadius = 1.1; },
        /radii must be within the ring system bounds/,
    ],
    [
        physical => { physical.body.rings.bands[0].edgeSoftness = 1; },
        /edgeSoftness must not exceed half the band width/,
    ],
    [
        physical =>
        {
            physical.body.rings.innerRadius = 1.01;
            physical.body.rings.bands[0].innerRadius = 1.01;
        },
        /innerRadius must be > the maximum surface radius multiplier/,
    ],
    [
        physical =>
        {
            physical.body.rings.textureWidth = 16;
            physical.body.rings.bands = [{
                ...physical.body.rings.bands[0],
                innerRadius: 1.30,
                outerRadius: 1.31,
                edgeSoftness: 0,
            }];
        },
        /width must be at least one profile texel/,
    ],
    [
        physical => { physical.body.rings.forwardScattering = Number.NaN; },
        /forwardScattering must be a finite number/,
    ],
    [
        physical =>
        {
            physical.body.companions[0].rings = structuredClone(physical.body.rings);
            physical.body.companions[0].rings.bands[0].opacity = 1.1;
        },
        /companions\[0\]\.rings\.bands\[0\]\.opacity must be between 0 and 1/,
    ],
    [
        physical => { physical.body.companions = {}; },
        /companions must be an array/,
    ],
];

for (const [mutate, expected] of invalidCases)
{
    const physical = createSeededPhysical();
    mutate(physical);
    assert.throws(() => validateConfigs(physical, behaviour), expected);
}

console.log('Planetary ring recursive validation invariants passed');

function createSeededPhysical()
{
    return createPhysical({
        id: 'primary',
        seed: 1,
        companions: [
            { id: 'moon-1', seed: 2 },
            { id: 'satellite-1', seed: 3 },
            { id: 'satellite-2', seed: 4 },
        ],
    });
}
