import { createNoise3D } from '../../vendor/simplex-noise.js';
import { ImprovedPerlin3D } from './ImprovedPerlin3D.js';
import {
    createNamedRandom,
    namedVector3,
    normalizeSeed,
} from './SeededRandom.js';

export class TerrainField
{
    seed;
    params;
    shaderOffsets;
    paletteFactors;
    thresholds;

    #axis;
    #macro;
    #detail;
    #warp;
    #moisture;
    #temperature;
    #detailOffset;
    #moistureOffset;
    #temperatureOffset;

    constructor(seed, params, axisScale = [1, 1, 1])
    {
        this.seed = normalizeSeed(seed);
        this.params = params;
        this.#axis = axisScale;
        this.#macro = new ImprovedPerlin3D(createNamedRandom(this.seed, 'macro-permutation'));
        this.#detail = createNoise3D(createNamedRandom(this.seed, 'terrain-detail-simplex'));
        this.#warp = [
            createNoise3D(createNamedRandom(this.seed, 'domain-warp-x')),
            createNoise3D(createNamedRandom(this.seed, 'domain-warp-y')),
            createNoise3D(createNamedRandom(this.seed, 'domain-warp-z')),
        ];
        this.#moisture = createNoise3D(createNamedRandom(this.seed, 'climate-moisture'));
        this.#temperature = createNoise3D(createNamedRandom(this.seed, 'climate-temperature'));
        this.#detailOffset = namedVector3(this.seed, 'terrain-detail-offset');
        this.#moistureOffset = namedVector3(this.seed, 'moisture-offset');
        this.#temperatureOffset = namedVector3(this.seed, 'temperature-offset');
        this.shaderOffsets = Object.freeze(namedVector3(this.seed, 'shader-micro-offset', 64));
        this.paletteFactors = Object.freeze(this.#buildPaletteFactors());
        this.thresholds = Object.freeze(this.#buildThresholds());
    }

    sampleElevation(x, y, z)
    {
        const p = this.params;
        const sx = x * this.#axis[0];
        const sy = y * this.#axis[1];
        const sz = z * this.#axis[2];
        const macro = this.#macro.sample(
            sx * p.macroFrequency,
            sy * p.macroFrequency,
            sz * p.macroFrequency,
        );
        const ridge = (1 - Math.abs(macro)) * 2 - 1;
        const broad = macro + (ridge - macro) * p.ridgeStrength;
        const wf = p.warpFrequency;
        const ws = p.warpStrength;
        const wx = this.#warp[0](sx * wf, sy * wf, sz * wf) * ws;
        const wy = this.#warp[1](sx * wf, sy * wf, sz * wf) * ws;
        const wz = this.#warp[2](sx * wf, sy * wf, sz * wf) * ws;
        const detail = this.#fbm(
            this.#detail,
            (sx + wx) * p.detailFrequency + this.#detailOffset[0],
            (sy + wy) * p.detailFrequency + this.#detailOffset[1],
            (sz + wz) * p.detailFrequency + this.#detailOffset[2],
            p.detailOctaves,
        );
        const weight = p.macroStrength + p.detailStrength;
        const elevation = weight > 0
            ? (broad * p.macroStrength + detail * p.detailStrength) / weight
            : 0;

        return clamp(elevation, -1, 1);
    }

    sampleMoisture(x, y, z)
    {
        const p = this.params;
        const o = this.#moistureOffset;
        const value = this.#fbm(
            this.#moisture,
            x * p.moistureFrequency + o[0],
            y * p.moistureFrequency + o[1],
            z * p.moistureFrequency + o[2],
            p.climateOctaves,
        );

        return clamp(value * 0.5 + 0.5, 0, 1);
    }

    sampleTemperature(x, y, z, elevation)
    {
        const p = this.params;
        const o = this.#temperatureOffset;
        const noise = this.#fbm(
            this.#temperature,
            x * p.temperatureFrequency + o[0],
            y * p.temperatureFrequency + o[1],
            z * p.temperatureFrequency + o[2],
            p.climateOctaves,
        ) * 0.5 + 0.5;
        const latitude = 1 - Math.abs(y);
        const climate = noise * (1 - p.latitudeInfluence) + latitude * p.latitudeInfluence;
        const altitudeCooling = Math.max(0, elevation) * 0.22;

        return clamp(climate - altitudeCooling, 0, 1);
    }

    classifyBiome(elevation, moisture, temperature)
    {
        const t = this.thresholds;

        if (elevation < t.seaLevel) return 0;
        if (temperature < t.coldThreshold || elevation > t.snowLine) return 5;
        if (elevation < t.seaLevel + 0.14) return 1;
        if (moisture < t.dryThreshold) return 2;
        if (moisture > t.wetThreshold) return 3;
        if (elevation > t.snowLine * 0.72) return 4;

        return 3;
    }

    #fbm(noise, x, y, z, octaves)
    {
        let frequency = 1;
        let amplitude = 1;
        let sum = 0;
        let normalizer = 0;

        for (let octave = 0; octave < octaves; octave++)
        {
            sum += noise(x * frequency, y * frequency, z * frequency) * amplitude;
            normalizer += amplitude;
            frequency *= this.params.lacunarity;
            amplitude *= this.params.gain;
        }

        return normalizer > 0 ? sum / normalizer : 0;
    }

    #buildPaletteFactors()
    {
        const random = createNamedRandom(this.seed, 'palette-variation');
        const variation = this.params.paletteVariation;

        return this.params.palette.map(() => 1 + (random() * 2 - 1) * variation);
    }

    #buildThresholds()
    {
        const random = createNamedRandom(this.seed, 'biome-threshold-jitter');
        const jitter = () => (random() * 2 - 1) * 0.015;

        return {
            seaLevel: this.params.seaLevel + jitter(),
            snowLine: this.params.snowLine + jitter(),
            coldThreshold: this.params.coldThreshold + jitter(),
            dryThreshold: this.params.dryThreshold + jitter(),
            wetThreshold: this.params.wetThreshold + jitter(),
        };
    }
}

export function effectiveDisplacement(params)
{
    return params.maxDisplacement * (params.displacementMultiplier ?? 1);
}

function clamp(value, min, max)
{
    return Math.max(min, Math.min(max, value));
}
