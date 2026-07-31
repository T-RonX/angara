import { createNamedRandom, normalizeSeed } from './SeededRandom.js';

const CHANNEL_MIN = Object.freeze([-1, 0, 0]);
const CHANNEL_MAX = Object.freeze([1, 1, 1]);

export class BiomeModel
{
    colorFactors;
    resolvedBiomes;

    #biomeRegionOffsets;
    #regionRuleOffsets;
    #ruleChannels;
    #ruleMins;
    #ruleMaxs;

    constructor(seed, biomes, jitter = 0, colorVariation = 0)
    {
        const normalizedSeed = normalizeSeed(seed);
        this.colorFactors = Object.freeze(
            buildColorFactors(normalizedSeed, biomes.length, colorVariation),
        );

        const resolved = resolveBiomes(normalizedSeed, biomes, jitter);
        this.resolvedBiomes = resolved.biomes;
        this.#biomeRegionOffsets = resolved.biomeRegionOffsets;
        this.#regionRuleOffsets = resolved.regionRuleOffsets;
        this.#ruleChannels = resolved.ruleChannels;
        this.#ruleMins = resolved.ruleMins;
        this.#ruleMaxs = resolved.ruleMaxs;
    }

    classify(elevation, moisture, temperature)
    {
        for (let biome = 0; biome < this.#biomeRegionOffsets.length - 1; biome++)
        {
            const firstRegion = this.#biomeRegionOffsets[biome];
            const regionEnd = this.#biomeRegionOffsets[biome + 1];

            for (let region = firstRegion; region < regionEnd; region++)
            {
                let matches = true;

                for (
                    let rule = this.#regionRuleOffsets[region];
                    rule < this.#regionRuleOffsets[region + 1];
                    rule++
                )
                {
                    const channel = this.#ruleChannels[rule];
                    const value = channel === 0
                        ? elevation
                        : (channel === 1 ? moisture : temperature);

                    if (value < this.#ruleMins[rule] || value > this.#ruleMaxs[rule])
                    {
                        matches = false;

                        break;
                    }
                }

                if (matches) return biome;
            }
        }

        return 0;
    }
}

function buildColorFactors(seed, count, variation)
{
    const random = createNamedRandom(seed, 'palette-variation');
    const factors = new Array(count);

    for (let biome = 0; biome < count; biome++)
    {
        factors[biome] = 1 + (random() * 2 - 1) * variation;
    }

    return factors;
}

function resolveBiomes(seed, biomes, jitter)
{
    const random = createNamedRandom(seed, 'biome-threshold-jitter');
    const resolvedBounds = new Map();
    const resolvedBiomes = [];
    const biomeRegionOffsets = [0];
    const regionRuleOffsets = [0];
    const ruleChannels = [];
    const ruleMins = [];
    const ruleMaxs = [];

    const resolveBound = (channel, value) =>
    {
        if (value === CHANNEL_MIN[channel] || value === CHANNEL_MAX[channel]) return value;

        const key = `${channel}:${value}`;

        if (!resolvedBounds.has(key))
        {
            const offset = (random() * 2 - 1) * jitter;
            resolvedBounds.set(
                key,
                Math.max(CHANNEL_MIN[channel], Math.min(CHANNEL_MAX[channel], value + offset)),
            );
        }

        return resolvedBounds.get(key);
    };

    for (const biome of biomes)
    {
        const resolvedRegions = [];

        for (const region of biome.regions)
        {
            const resolvedRules = [];

            for (const rule of region)
            {
                const min = resolveBound(rule.channel, rule.min);
                const max = resolveBound(rule.channel, rule.max);
                const resolvedRule = Object.freeze({
                    channel: rule.channel,
                    min: Math.min(min, max),
                    max: Math.max(min, max),
                    blend: rule.blend,
                });

                resolvedRules.push(resolvedRule);
                ruleChannels.push(resolvedRule.channel);
                ruleMins.push(resolvedRule.min);
                ruleMaxs.push(resolvedRule.max);
            }

            resolvedRegions.push(Object.freeze(resolvedRules));
            regionRuleOffsets.push(ruleChannels.length);
        }

        resolvedBiomes.push(Object.freeze({
            color: biome.color,
            regions: Object.freeze(resolvedRegions),
            surface: Object.freeze({
                ...biome.surface,
                structure: Object.freeze({ ...biome.surface.structure }),
            }),
        }));
        biomeRegionOffsets.push(resolvedRegions.length + biomeRegionOffsets.at(-1));
    }

    return {
        biomes: Object.freeze(resolvedBiomes),
        biomeRegionOffsets: new Uint32Array(biomeRegionOffsets),
        regionRuleOffsets: new Uint32Array(regionRuleOffsets),
        ruleChannels: new Uint8Array(ruleChannels),
        ruleMins: new Float64Array(ruleMins),
        ruleMaxs: new Float64Array(ruleMaxs),
    };
}
