import assert from 'node:assert/strict';
import { behaviour } from '../config/behaviour.js';
import { validateConfigs } from '../config/ConfigValidator.js';
import { createPhysical } from '../config/physical.js';
import {
    effectiveDisplacement,
    TerrainField,
} from '../texture/procedural/TerrainField.js';
import { generateTileDataWithField } from '../texture/procedural/generateTileData.js';
import {
    ShapeSampler,
    buildGoldbergFaces,
    buildSurfaceGeometry,
} from '../worker/GoldbergGen.js';

const originalRandom = Math.random;
Math.random = () =>
{
    throw new Error('procedural terrain must not use Math.random');
};

try
{
    const physical = createSeededPhysical();
    assert.doesNotThrow(() => validateConfigs(physical, behaviour));

    const profileFaces = buildGoldbergFaces(8);
    const bodies = [physical.body, ...physical.body.companions];
    assert.deepEqual(
        bodies.map(body => body.terrain.profile),
        ['temperate', 'barren', 'arid', 'glacial'],
    );

    for (const body of bodies)
    {
        const axis = body.shape.axisScale ?? [1, 1, 1];
        const fieldA = new TerrainField(body.seed, body.terrain, axis);
        const fieldB = new TerrainField(body.seed, body.terrain, axis);
        const differentSeed = new TerrainField(body.seed + 100, body.terrain, axis);
        const tilesA = generateTileDataWithField(profileFaces.dirs, fieldA);
        const tilesB = generateTileDataWithField(profileFaces.dirs, fieldB);
        const tilesDifferent = generateTileDataWithField(profileFaces.dirs, differentSeed);
        const elevations = [];

        assert.deepEqual(bytes(tilesA.packed), bytes(tilesB.packed));
        assert.notDeepEqual(bytes(tilesA.packed), bytes(tilesDifferent.packed));
        assert.deepEqual(fieldA.biomeModel.resolvedBiomes, fieldB.biomeModel.resolvedBiomes);
        assert.deepEqual(fieldA.biomeModel.colorFactors, fieldB.biomeModel.colorFactors);
        assert.equal(tilesA.count, 10 * 8 ** 2 + 2);
        assert.ok(effectiveDisplacement(body.terrain) > 0);
        assert.ok(effectiveDisplacement(body.terrain) < 0.5);

        const workerSampler = new ShapeSampler(
            body.shape,
            100,
            body.seed,
            body.terrain,
        );

        for (let cell = 0; cell < tilesA.count; cell++)
        {
            const direction = cell * 3;
            const record = cell * 4;
            const x = profileFaces.dirs[direction];
            const y = profileFaces.dirs[direction + 1];
            const z = profileFaces.dirs[direction + 2];
            const elevation = fieldA.sampleElevation(x, y, z);
            const moisture = fieldA.sampleMoisture(x, y, z);
            const temperature = fieldA.sampleTemperature(x, y, z, elevation);

            elevations.push(elevation);
            assert.equal(tilesA.packed[record], Math.fround(elevation));
            assert.ok(elevation >= -1 && elevation <= 1);
            assert.ok(moisture >= 0 && moisture <= 1);
            assert.ok(temperature >= 0 && temperature <= 1);
            assert.ok(Number.isInteger(tilesA.packed[record + 2]));
            assert.ok(
                tilesA.packed[record + 2] >= 0
                && tilesA.packed[record + 2] < body.terrain.biomes.length,
            );
            assert.equal(workerSampler.field.sampleElevation(x, y, z), elevation);
        }

        const stats = distribution(elevations);
        assert.ok(
            stats.range > 0.2,
            `${body.terrain.profile} terrain must contain meaningful relief`,
        );
        assert.ok(
            stats.deviation > 0.055,
            `${body.terrain.profile} terrain must not collapse to a flat field`,
        );
        assert.ok(
            stats.saturatedFraction < 0.01,
            `${body.terrain.profile} terrain must not rely on clamping`,
        );
    }

    const biomeFaces = buildGoldbergFaces(4);
    const baseTerrain = physical.body.terrain;

    for (const biomeCount of [1, 2, 5, 10])
    {
        const dynamicTerrain = {
            ...baseTerrain,
            biomes: createBiomes(biomeCount),
        };
        const dynamicA = new TerrainField(90210, dynamicTerrain);
        const dynamicB = new TerrainField(90210, dynamicTerrain);
        const dynamicTiles = generateTileDataWithField(biomeFaces.dirs, dynamicA);

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

    const invalidTerrainCases = [
        [
            physical => { physical.body.terrain.profile = 'gas'; },
            /profile must be 'temperate'/,
        ],
        [
            physical => { physical.body.terrain.continental.octaves = 6; },
            /continental\.octaves must be an integer/,
        ],
        [
            physical => { physical.body.terrain.mountains.frequency = 0; },
            /mountains\.frequency must be a finite number/,
        ],
        [
            physical =>
            {
                physical.body.terrain.mountains.maskMin = 0.5;
                physical.body.terrain.mountains.maskMax = 0.5;
            },
            /mountains\.maskMin must be < maskMax/,
        ],
        [
            physical => { physical.body.terrain.surface.macroNormalStrength = 1.1; },
            /surface\.macroNormalStrength must be between 0 and 1/,
        ],
        [
            physical =>
            {
                physical.body.terrain.surface.roughnessMin = 0.9;
                physical.body.terrain.surface.roughnessMax = 0.4;
            },
            /surface\.roughnessMin must be <= roughnessMax/,
        ],
        [
            physical =>
            {
                physical.body.terrain.maxDisplacement = 0.3;
                physical.body.terrain.displacementMultiplier = 2;
            },
            /effective displacement must be < 0.5/,
        ],
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
            physical => { physical.body.terrain.biomes[0].surface.structure.type = 'volcanoes'; },
            /surface\.structure\.type is not supported/,
        ],
        [
            physical =>
            {
                physical.body.terrain.biomes[0].surface.microFrequencyMultiplier = 0;
            },
            /microFrequencyMultiplier must be a finite number >= 0.1/,
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

    for (const [mutate, expected] of invalidTerrainCases)
    {
        const invalidPhysical = createSeededPhysical();
        invalidPhysical.body.terrain.biomes = createBiomes(2);
        mutate(invalidPhysical);
        assert.throws(() => validateConfigs(invalidPhysical, behaviour), expected);
    }

    const invalidBehaviourCases = [
        [
            config => { config.cellOutlines.opacity = 1.1; },
            /cellOutlines\.opacity must be between 0 and 1/,
        ],
        [
            config => { config.cellOutlines.fadeStartRadius = config.cellOutlines.fadeEndRadius; },
            /fadeStartRadius must be < fadeEndRadius/,
        ],
        [
            config => { config.cellOutlines.surfaceLift = 0.02; },
            /cellOutlines\.surfaceLift must be between 0 and 0.01/,
        ],
        [
            config =>
            {
                config.materials.procedural.detailFadeStart = 2;
                config.materials.procedural.detailFadeEnd = 1;
            },
            /detailFadeStart must be < detailFadeEnd/,
        ],
        [
            config =>
            {
                config.materials.procedural.normalFadeStart = 1;
                config.materials.procedural.normalFadeEnd = 1;
            },
            /normalFadeStart must be < normalFadeEnd/,
        ],
    ];

    for (const [mutate, expected] of invalidBehaviourCases)
    {
        const invalidBehaviour = structuredClone(behaviour);
        mutate(invalidBehaviour);
        assert.throws(() => validateConfigs(createSeededPhysical(), invalidBehaviour), expected);
    }

    const radius = 100;
    const coreRadius = 60;
    const layerFrac = [1, 0.9];
    const terrain = physical.body.terrain;
    const axis = physical.body.shape.axisScale;
    const field = new TerrainField(physical.body.seed, terrain, axis);
    const sampler = new ShapeSampler(
        physical.body.shape,
        radius,
        physical.body.seed,
        terrain,
    );
    const surface = buildSurfaceGeometry(
        biomeFaces,
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
            const elevation = field.sampleElevation(x, y, z);
            const expectedRadius = radius * (1 + elevation * displacement);

            assert.ok(Math.abs(value - expectedRadius) < 1e-4);
            assert.ok(Math.abs(surface.terrainClimate[climate] - elevation) < 1e-6);
            assert.ok(Math.abs(
                surface.terrainClimate[climate + 1] - field.sampleMoisture(x, y, z),
            ) < 1e-6);
            assert.ok(Math.abs(
                surface.terrainClimate[climate + 2]
                - field.sampleTemperature(x, y, z, elevation),
            ) < 1e-6);
        }
    }

    const primaryCount = 10 * physical.body.hexFrequency ** 2 + 2;
    assert.equal(Math.ceil(primaryCount / terrain.textureWidth), 11);
}
finally
{
    Math.random = originalRandom;
}

console.log('Procedural terrain profiles, determinism, validation, and geometry invariants passed');

function bytes(array)
{
    return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

function distribution(values)
{
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let squared = 0;
    let saturated = 0;

    for (const value of values)
    {
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
        squared += value * value;
        if (Math.abs(value) >= 0.999) saturated++;
    }

    const mean = sum / values.length;

    return {
        range: max - min,
        deviation: Math.sqrt(Math.max(0, squared / values.length - mean * mean)),
        saturatedFraction: saturated / values.length,
    };
}

function createBiomes(count)
{
    if (count === 1)
    {
        return [{
            color: 0x336699,
            surface: {
                macroNormalMultiplier: 0.5,
                microNormalMultiplier: 0.25,
                microFrequencyMultiplier: 0.75,
                albedoVariation: 0.1,
                roughnessBias: 0,
                structure: {
                    type: 'none',
                    frequency: 1,
                    strength: 0,
                },
            },
            regions: [[]],
        }];
    }

    return Array.from({ length: count }, (_, biome) => ({
        color: (0x102030 + biome * 0x111111) & 0xffffff,
        surface: {
            macroNormalMultiplier: 0.5,
            microNormalMultiplier: 0.25,
            microFrequencyMultiplier: 0.75,
            albedoVariation: 0.1,
            roughnessBias: 0,
            structure: {
                type: 'none',
                frequency: 1,
                strength: 0,
            },
        },
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
