import assert from 'node:assert/strict';

import { buildRingProfile } from '../ring/RingProfile.js';

const rings = {
    innerRadius: 1,
    outerRadius: 2,
    textureWidth: 1000,
    bands: [
        {
            innerRadius: 1.20,
            outerRadius: 1.50,
            color: 0xb8aa92,
            opacity: 0.8,
            density: 0.75,
            edgeSoftness: 0.05,
            variationScale: 180,
            variationStrength: 0.25,
        },
        {
            innerRadius: 1.70,
            outerRadius: 1.90,
            color: 0x8e877c,
            opacity: 0.45,
            density: 0.6,
            edgeSoftness: 0,
            variationScale: 240,
            variationStrength: 0.2,
        },
    ],
};

const originalRandom = Math.random;
Math.random = () =>
{
    throw new Error('ring profiles must not use Math.random');
};

try
{
    const first = buildRingProfile(rings, 12345);
    const repeated = buildRingProfile(rings, 12345);
    const otherSeed = buildRingProfile(rings, 12346);

    assert.deepEqual(first, repeated);
    assert.notDeepEqual(first.data, otherSeed.data);
    assert.equal(first.width, rings.textureWidth);
    assert.equal(first.data.length, rings.textureWidth * 4);

    assert.equal(alphaAt(first, 1.10), 0);
    assert.equal(alphaAt(first, 1.60), 0);
    assert.equal(alphaAt(first, 1.95), 0);
    assert.ok(alphaAt(first, 1.35) > 0);
    assert.ok(alphaAt(first, 1.80) > 0);
    assert.ok(alphaAt(first, 1.205) < alphaAt(first, 1.25));
    assert.ok(alphaAt(first, 1.495) < alphaAt(first, 1.45));

    const narrow = buildRingProfile({
        innerRadius: 1,
        outerRadius: 2,
        textureWidth: 16,
        bands: [{
            ...rings.bands[1],
            innerRadius: 1.10,
            outerRadius: 1.17,
            edgeSoftness: 0.02,
        }],
    }, 12345);
    assert.ok(narrow.data.some((value, index) => index % 4 === 3 && value > 0));
}
finally
{
    Math.random = originalRandom;
}

console.log('Planetary ring profile determinism and band invariants passed');

function alphaAt(profile, radius)
{
    const normalized = (radius - profile.innerRadius)
        / (profile.outerRadius - profile.innerRadius);
    const texel = Math.max(0, Math.min(profile.width - 1, Math.floor(normalized * profile.width)));

    return profile.data[texel * 4 + 3];
}
