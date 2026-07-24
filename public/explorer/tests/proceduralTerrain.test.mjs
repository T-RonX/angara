import assert from 'node:assert/strict';
import { behaviour } from '../config/behaviour.js';
import { validateConfigs } from '../config/ConfigValidator.js';
import { createPhysical } from '../config/physical.js';
import { TerrainField } from '../texture/procedural/TerrainField.js';
import { generateTileDataWithField } from '../texture/procedural/generateTileData.js';
import {
    ShapeSampler,
    buildGoldbergFaces,
    buildSurfaceGeometry,
} from '../worker/GoldbergGen.js';
import { effectiveDisplacement } from '../texture/procedural/TerrainField.js';

const terrain = {
    maxDisplacement: 0.11,
    displacementMultiplier: 1.5,
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
    biomes: createBiomes(6),
    biomeJitter: 0.015,
    biomeColorVariation: 0.08,
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
    assert.deepEqual(fieldA.biomeModel.resolvedBiomes, fieldB.biomeModel.resolvedBiomes);
    assert.deepEqual(fieldA.biomeModel.colorFactors, fieldB.biomeModel.colorFactors);
    assert.notDeepEqual(fieldA.biomeModel.resolvedBiomes, fieldC.biomeModel.resolvedBiomes);
    assert.notDeepEqual(fieldA.biomeModel.colorFactors, fieldC.biomeModel.colorFactors);
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
        assert.ok(
            tilesA.packed[record + 2] >= 0
            && tilesA.packed[record + 2] < terrain.biomes.length,
        );
        assert.ok(tilesA.packed[record + 3] >= 0 && tilesA.packed[record + 3] <= 1);
    }

    for (const biomeCount of [1, 2, 5, 10])
    {
        const dynamicTerrain = {
            ...terrain,
            biomes: createBiomes(biomeCount),
        };
        const dynamicA = new TerrainField(90210, dynamicTerrain);
        const dynamicB = new TerrainField(90210, dynamicTerrain);
        const dynamicTiles = generateTileDataWithField(faces.dirs, dynamicA);

        assert.equal(dynamicA.biomeModel.resolvedBiomes.length, biomeCount);
        assert.equal(dynamicA.biomeModel.colorFactors.length, biomeCount);
        assert.deepEqual(dynamicA.biomeModel.resolvedBiomes, dynamicB.biomeModel.resolvedBiomes);
        assert.deepEqual(dynamicA.biomeModel.colorFactors, dynamicB.biomeModel.colorFactors);

        for (let record = 2; record < dynamicTiles.packed.length; record += 4)
        {
            assert.ok(dynamicTiles.packed[record] >= 0);
            assert.ok(dynamicTiles.packed[record] < biomeCount);
        }

        for (let biome = 0; biome < biomeCount; biome++)
        {
            const elevation = biomeCount === 1 ? 0 : -1 + (biome + 0.5) * 2 / biomeCount;
            assert.equal(dynamicA.classifyBiome(elevation, 0.5, 0.5), biome);
        }

        const dynamicPhysical = createSeededPhysical();
        dynamicPhysical.body.terrain.biomes = createBiomes(biomeCount);
        assert.doesNotThrow(() => validateConfigs(dynamicPhysical, behaviour));
    }

    const invalidBiomeCases = [
        [
            physical => { physical.body.terrain.biomes = []; },
            /biomes must be a non-empty array/,
        ],
        [
            physical => { physical.body.terrain.biomes[0].color = 0x1000000; },
            /color must be a 24-bit integer/,
        ],
        [
            physical => { physical.body.terrain.biomes[0].regions[0][0].channel = 3; },
            /channel must be 0, 1, or 2/,
        ],
        [
            physical => { physical.body.terrain.biomes[0].regions[0][0].min = -2; },
            /bounds must be within/,
        ],
        [
            physical =>
            {
                physical.body.terrain.biomes[0].regions[0][0].min = 0.5;
                physical.body.terrain.biomes[0].regions[0][0].max = -0.5;
            },
            /min must be <= max/,
        ],
        [
            physical => { physical.body.terrain.biomes[0].regions[0][0].blend = -0.1; },
            /blend must be >= 0/,
        ],
        [
            physical => { physical.body.terrain.biomeJitter = 1.1; },
            /biomeJitter must be between 0 and 1/,
        ],
        [
            physical => { physical.body.terrain.biomes = createBiomes(33); },
            /biomes must contain at most 32 entries/,
        ],
        [
            physical =>
            {
                physical.body.terrain.biomes[0].regions = Array.from(
                    { length: 65 },
                    () => [],
                );
            },
            /biomes must contain at most 64 regions/,
        ],
        [
            physical =>
            {
                const rule = physical.body.terrain.biomes[0].regions[0][0];
                physical.body.terrain.biomes[0].regions[0] = Array.from(
                    { length: 129 },
                    () => ({ ...rule }),
                );
            },
            /biomes must contain at most 128 rules/,
        ],
    ];

    for (const [mutate, expected] of invalidBiomeCases)
    {
        const invalidPhysical = createSeededPhysical();
        invalidPhysical.body.terrain.biomes = createBiomes(2);
        mutate(invalidPhysical);
        assert.throws(() => validateConfigs(invalidPhysical, behaviour), expected);
    }

    const radius = 100;
    const coreRadius = 60;
    const layerFrac = [1, 0.9];
    const sampler = new ShapeSampler(
        { type: 'sphere', axisScale: [1, 0.82, 1.15] },
        radius,
        1337,
        terrain,
    );
    const surface = buildSurfaceGeometry(
        faces,
        layerFrac,
        coreRadius,
        68,
        sampler,
    );

    assert.equal(surface.tileIds.length, surface.positions.length / 3);
    assert.equal(surface.outward.length, surface.positions.length / 3);
    assert.equal(surface.terrainClimate.length, surface.positions.length);
    assert.ok(surface.outward.some(value => value === 1));
    assert.ok(surface.outward.some(value => value === 0));

    for (let offset = 0, vertex = 0; offset < surface.positions.length; offset += 3, vertex++)
    {
        const value = Math.hypot(
            surface.positions[offset],
            surface.positions[offset + 1],
            surface.positions[offset + 2],
        );

        const displacement = effectiveDisplacement(terrain);
        assert.ok(value >= radius * (1 - displacement) - 4.001);
        assert.ok(value <= radius * (1 + displacement) + 0.001);
        assert.ok(value >= coreRadius);

        if (surface.outward[vertex] === 1)
        {
            const climate = vertex * 3;
            const x = surface.positions[offset] / value;
            const y = surface.positions[offset + 1] / value;
            const z = surface.positions[offset + 2] / value;
            assert.ok(Math.abs(
                surface.terrainClimate[climate] - fieldA.sampleElevation(x, y, z),
            ) < 1e-6);
            assert.ok(Math.abs(
                surface.terrainClimate[climate + 1] - fieldA.sampleMoisture(x, y, z),
            ) < 1e-6);
            const elevation = fieldA.sampleElevation(x, y, z);
            assert.ok(Math.abs(
                surface.terrainClimate[climate + 2]
                - fieldA.sampleTemperature(x, y, z, elevation),
            ) < 1e-6);
        }
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

function createBiomes(count)
{
    if (count === 1)
    {
        return [{ color: 0x336699, regions: [[]] }];
    }

    return Array.from({ length: count }, (_, biome) => ({
        color: (0x102030 + biome * 0x111111) & 0xffffff,
        regions: [[{
            channel: 0,
            min: -1 + biome * 2 / count,
            max: -1 + (biome + 1) * 2 / count,
            blend: 0.04,
        }]],
    }));
}

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
