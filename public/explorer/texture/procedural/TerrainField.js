import { createNoise3D } from '../../vendor/simplex-noise.js';
import { ImprovedPerlin3D } from './ImprovedPerlin3D.js';
import { BiomeModel } from './BiomeModel.js';
import {
    createNamedRandom,
    namedVector3,
    normalizeSeed,
} from './SeededRandom.js';

const PROFILE_TEMPERATE = 0;
const PROFILE_BARREN = 1;
const PROFILE_ARID = 2;
const PROFILE_GLACIAL = 3;

export class TerrainField
{
    seed;
    params;
    shaderOffsets;
    biomeModel;

    #axis;
    #profile;
    #continental;
    #mountain;
    #detail;
    #feature;
    #warp;
    #moisture;
    #temperature;
    #continentalOffset;
    #mountainOffset;
    #detailOffset;
    #featureOffset;
    #moistureOffset;
    #temperatureOffset;

    constructor(seed, params, axisScale = [1, 1, 1])
    {
        this.seed = normalizeSeed(seed);
        this.params = params;
        this.#axis = axisScale;
        this.#profile = profileIndex(params.profile);
        this.#continental = new ImprovedPerlin3D(
            createNamedRandom(this.seed, 'continental-permutation'),
        );
        this.#mountain = createNoise3D(createNamedRandom(this.seed, 'mountain-ridges'));
        this.#detail = createNoise3D(createNamedRandom(this.seed, 'terrain-erosion-detail'));
        this.#feature = createNoise3D(createNamedRandom(this.seed, `terrain-${params.profile}-feature`));
        this.#warp = [
            createNoise3D(createNamedRandom(this.seed, 'mountain-warp-x')),
            createNoise3D(createNamedRandom(this.seed, 'mountain-warp-y')),
            createNoise3D(createNamedRandom(this.seed, 'mountain-warp-z')),
        ];
        this.#moisture = createNoise3D(createNamedRandom(this.seed, 'climate-moisture'));
        this.#temperature = createNoise3D(createNamedRandom(this.seed, 'climate-temperature'));
        this.#continentalOffset = namedVector3(this.seed, 'continental-offset');
        this.#mountainOffset = namedVector3(this.seed, 'mountain-offset');
        this.#detailOffset = namedVector3(this.seed, 'terrain-detail-offset');
        this.#featureOffset = namedVector3(this.seed, `${params.profile}-feature-offset`);
        this.#moistureOffset = namedVector3(this.seed, 'moisture-offset');
        this.#temperatureOffset = namedVector3(this.seed, 'temperature-offset');
        this.shaderOffsets = Object.freeze(namedVector3(this.seed, 'shader-surface-offset', 64));
        this.biomeModel = new BiomeModel(
            this.seed,
            this.params.biomes,
            this.params.biomeJitter,
            this.params.biomeColorVariation,
        );
    }

    sampleElevation(x, y, z)
    {
        const sx = x * this.#axis[0];
        const sy = y * this.#axis[1];
        const sz = z * this.#axis[2];
        const continental = this.#sampleContinental(sx, sy, sz);
        const mountainMask = smoothstep(
            this.params.mountains.maskMin,
            this.params.mountains.maskMax,
            continental,
        );
        const mountains = this.#sampleMountains(sx, sy, sz, mountainMask);
        const detail = this.#sampleDetail(sx, sy, sz, continental);
        const feature = this.#sampleProfileFeature(sx, sy, sz, continental, mountainMask);
        const elevation = continental * this.params.continental.strength
            + mountains
            + detail
            + feature;

        return clamp(elevation, -1, 1);
    }

    sampleMoisture(x, y, z)
    {
        const p = this.params.climate;
        const o = this.#moistureOffset;
        const value = this.#fbm(
            this.#moisture,
            x * p.moistureFrequency + o[0],
            y * p.moistureFrequency + o[1],
            z * p.moistureFrequency + o[2],
            p.octaves,
            p.lacunarity,
            p.gain,
        );

        return clamp(value * 0.5 + 0.5, 0, 1);
    }

    sampleTemperature(x, y, z, elevation)
    {
        const p = this.params.climate;
        const o = this.#temperatureOffset;
        const noise = this.#fbm(
            this.#temperature,
            x * p.temperatureFrequency + o[0],
            y * p.temperatureFrequency + o[1],
            z * p.temperatureFrequency + o[2],
            p.octaves,
            p.lacunarity,
            p.gain,
        ) * 0.5 + 0.5;
        const latitude = 1 - Math.abs(y);
        const climate = noise * (1 - p.latitudeInfluence) + latitude * p.latitudeInfluence;
        const altitudeCooling = Math.max(0, elevation) * p.altitudeCooling;

        return clamp(climate - altitudeCooling, 0, 1);
    }

    classifyBiome(elevation, moisture, temperature)
    {
        return this.biomeModel.classify(elevation, moisture, temperature);
    }

    #sampleContinental(x, y, z)
    {
        const p = this.params.continental;
        const o = this.#continentalOffset;
        const value = this.#perlinFbm(
            x * p.frequency + o[0],
            y * p.frequency + o[1],
            z * p.frequency + o[2],
            p.octaves,
            p.lacunarity,
            p.gain,
        );

        return clamp(value - p.seaLevel, -1, 1);
    }

    #sampleMountains(x, y, z, mask)
    {
        const p = this.params.mountains;
        const wf = p.warpFrequency;
        const ws = p.warpStrength;
        const wx = this.#warp[0](x * wf, y * wf, z * wf) * ws;
        const wy = this.#warp[1](x * wf, y * wf, z * wf) * ws;
        const wz = this.#warp[2](x * wf, y * wf, z * wf) * ws;
        const o = this.#mountainOffset;
        const ridge = this.#ridgedFbm(
            (x + wx) * p.frequency + o[0],
            (y + wy) * p.frequency + o[1],
            (z + wz) * p.frequency + o[2],
            p.octaves,
            p.lacunarity,
            p.gain,
        );
        const shaped = Math.pow(ridge, p.sharpness);

        return (shaped - 0.12) * p.strength * mask;
    }

    #sampleDetail(x, y, z, continental)
    {
        const p = this.params.detail;
        const o = this.#detailOffset;
        const landMask = smoothstep(-0.22, 0.28, continental);
        const value = this.#fbm(
            this.#detail,
            x * p.frequency + o[0],
            y * p.frequency + o[1],
            z * p.frequency + o[2],
            p.octaves,
            p.lacunarity,
            p.gain,
        );

        return value * p.strength * (0.3 + landMask * 0.7);
    }

    #sampleProfileFeature(x, y, z, continental, mountainMask)
    {
        const p = this.params.feature;
        const o = this.#featureOffset;
        const value = this.#feature(
            x * p.frequency + o[0],
            y * p.frequency + o[1],
            z * p.frequency + o[2],
        );

        if (this.#profile === PROFILE_BARREN)
        {
            const radial = Math.abs(value);
            const rim = Math.max(0, 1 - Math.abs(radial - 0.38) * p.sharpness);
            const bowl = Math.max(0, 1 - radial * p.sharpness * 0.58);

            return (rim * 0.42 - bowl * 0.72) * p.strength;
        }

        if (this.#profile === PROFILE_ARID)
        {
            const strata = Math.sin((y + value * 0.11) * p.frequency * Math.PI);
            const plateauMask = smoothstep(-0.18, 0.42, continental);

            return strata * p.strength * plateauMask * 0.55;
        }

        if (this.#profile === PROFILE_GLACIAL)
        {
            const crevasse = Math.pow(1 - Math.abs(value), p.sharpness);
            const iceMask = smoothstep(-0.3, 0.2, continental);

            return (-crevasse + value * 0.12) * p.strength * iceMask;
        }

        const drainage = Math.pow(Math.abs(value), p.sharpness);

        return -drainage * p.strength * mountainMask;
    }

    #perlinFbm(x, y, z, octaves, lacunarity, gain)
    {
        let frequency = 1;
        let amplitude = 1;
        let sum = 0;
        let normalizer = 0;

        for (let octave = 0; octave < octaves; octave++)
        {
            sum += this.#continental.sample(
                x * frequency,
                y * frequency,
                z * frequency,
            ) * amplitude;
            normalizer += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }

        return normalizer > 0 ? sum / normalizer : 0;
    }

    #ridgedFbm(x, y, z, octaves, lacunarity, gain)
    {
        let frequency = 1;
        let amplitude = 1;
        let sum = 0;
        let normalizer = 0;

        for (let octave = 0; octave < octaves; octave++)
        {
            const ridge = 1 - Math.abs(this.#mountain(
                x * frequency,
                y * frequency,
                z * frequency,
            ));
            sum += ridge * amplitude;
            normalizer += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }

        return normalizer > 0 ? sum / normalizer : 0;
    }

    #fbm(noise, x, y, z, octaves, lacunarity, gain)
    {
        let frequency = 1;
        let amplitude = 1;
        let sum = 0;
        let normalizer = 0;

        for (let octave = 0; octave < octaves; octave++)
        {
            sum += noise(x * frequency, y * frequency, z * frequency) * amplitude;
            normalizer += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }

        return normalizer > 0 ? sum / normalizer : 0;
    }
}

export function effectiveDisplacement(params)
{
    return params.maxDisplacement * (params.displacementMultiplier ?? 1);
}

function profileIndex(profile)
{
    if (profile === 'barren') return PROFILE_BARREN;
    if (profile === 'arid') return PROFILE_ARID;
    if (profile === 'glacial') return PROFILE_GLACIAL;

    return PROFILE_TEMPERATE;
}

function smoothstep(edge0, edge1, value)
{
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

    return t * t * (3 - 2 * t);
}

function clamp(value, min, max)
{
    return Math.max(min, Math.min(max, value));
}
