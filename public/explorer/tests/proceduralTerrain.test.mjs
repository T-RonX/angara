import assert from 'node:assert/strict';
import { TerrainField } from '../texture/procedural/TerrainField.js';
import { generateTileDataWithField } from '../texture/procedural/generateTileData.js';
import {
    ShapeSampler,
    buildGoldbergFaces,
    buildSurfaceGeometry,
} from '../worker/GoldbergGen.js';

const terrain = {
    maxDisplacement: 0.11,
    macroFrequency: 1.35,
    macroStrength: 0.72,
    ridgeStrength: 0.28,
    detailFrequency: 3.4,
    detailStrength: 0.28,
    detailOctaves: 4,
    lacunarity: 2,
    gain: 0.5,
    warpFrequency: 1.1,
    warpStrength: 0.45,
    climateOctaves: 4,
    moistureFrequency: 1.7,
    temperatureFrequency: 1.25,
    latitudeInfluence: 0.62,
    seaLevel: -0.2,
    snowLine: 0.48,
    coldThreshold: 0.3,
    dryThreshold: 0.34,
    wetThreshold: 0.68,
    palette: [0x183f70, 0xd2ba79, 0xb89151, 0x6f8b57, 0x315b39, 0xe8edf2],
    paletteVariation: 0.08,
    textureWidth: 1024,
    shader: {
        octaves: 2,
        frequency: 42,
        strength: 0.055,
        normalStrength: 0.32,
    },
};

const originalRandom = Math.random;
Math.random = () =>
{
    throw new Error('procedural terrain must not use Math.random');
};

try
{
    const faces = buildGoldbergFaces(4);
    const fieldA = new TerrainField(1337, terrain, [1, 0.82, 1.15]);
    const fieldB = new TerrainField(1337, terrain, [1, 0.82, 1.15]);
    const fieldC = new TerrainField(1338, terrain, [1, 0.82, 1.15]);
    const tilesA = generateTileDataWithField(faces.dirs, fieldA);
    const tilesB = generateTileDataWithField(faces.dirs, fieldB);
    const tilesC = generateTileDataWithField(faces.dirs, fieldC);

    assert.deepEqual(bytes(tilesA.packed), bytes(tilesB.packed));
    assert.notDeepEqual(bytes(tilesA.packed), bytes(tilesC.packed));
    assert.equal(tilesA.count, 10 * 4 ** 2 + 2);

    for (let cell = 0; cell < tilesA.count; cell++)
    {
        const direction = cell * 3;
        const record = cell * 4;
        const elevation = fieldA.sampleElevation(
            faces.dirs[direction],
            faces.dirs[direction + 1],
            faces.dirs[direction + 2],
        );

        assert.equal(tilesA.packed[record], Math.fround(elevation));
        assert.ok(tilesA.packed[record] >= -1 && tilesA.packed[record] <= 1);
        assert.ok(tilesA.packed[record + 1] >= 0 && tilesA.packed[record + 1] <= 1);
        assert.ok(Number.isInteger(tilesA.packed[record + 2]));
        assert.ok(tilesA.packed[record + 2] >= 0 && tilesA.packed[record + 2] <= 5);
        assert.ok(tilesA.packed[record + 3] >= 0 && tilesA.packed[record + 3] <= 1);
    }

    const radius = 100;
    const sampler = new ShapeSampler(
        { type: 'sphere', axisScale: [1, 0.82, 1.15] },
        radius,
        1337,
        terrain,
    );
    const surface = buildSurfaceGeometry(
        faces,
        [4],
        60,
        68,
        sampler,
    );

    assert.equal(surface.tileIds.length, surface.positions.length / 3);
    assert.equal(surface.outward.length, surface.positions.length / 3);
    assert.ok(surface.outward.some(value => value === 1));
    assert.ok(surface.outward.some(value => value === 0));

    for (let offset = 0; offset < surface.positions.length; offset += 3)
    {
        const value = Math.hypot(
            surface.positions[offset],
            surface.positions[offset + 1],
            surface.positions[offset + 2],
        );

        assert.ok(value >= radius * (1 - terrain.maxDisplacement) - 4.001);
        assert.ok(value <= radius * (1 + terrain.maxDisplacement) + 0.001);
    }

    const currentPrimaryCount = 10 * 64 ** 2 + 2;
    assert.equal(Math.ceil(currentPrimaryCount / terrain.textureWidth), 41);
}
finally
{
    Math.random = originalRandom;
}

console.log('Procedural terrain determinism and geometry invariants passed');

function bytes(array)
{
    return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}
