// ----------------------------------------------------------------------
// ConfigValidator — validates the physical + behaviour configs before any
// resource is created. Throws a descriptive Error on the first violation
// so mis-configurations are caught at startup, not as downstream null
// dereferences.
//
// Call `validateConfigs(physical, behaviour)` once in index.js before
// constructing BodyExplorer.
// ----------------------------------------------------------------------

// Required scalar fields on a body config (primary or companion).
const BODY_REQUIRED = [
    'id', 'name', 'hexFrequency', 'maxDepth', 'shape',
    'coreColor', 'depthColors', 'gridColor',
];

// Required top-level keys in behaviour.
const BEHAVIOUR_REQUIRED = [
    'scene', 'camera', 'input', 'generation', 'lod',
    'transition', 'atmosphere', 'slice', 'lighting', 'starfield',
    'highlights', 'materials', 'debug',
];

const MAX_BIOMES = 32;
const MAX_BIOME_REGIONS = 64;
const MAX_BIOME_RULES = 128;
const MAX_RING_PROFILE_WIDTH = 16384;

function assertNumber(obj, path, label, min = -Infinity)
{
    assertPath(obj, path, label);

    const value = path.split('.').reduce((current, part) => current[part], obj);

    if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    {
        throw new Error(`[ConfigValidator] ${label}.${path} must be a finite number >= ${min}`);
    }
}

function assertBoolean(obj, path, label)
{
    assertPath(obj, path, label);

    const value = path.split('.').reduce((current, part) => current[part], obj);

    if (typeof value !== 'boolean')
    {
        throw new Error(`[ConfigValidator] ${label}.${path} must be a boolean`);
    }
}

function assertInteger(obj, path, label, min = -Infinity, max = Infinity)
{
    assertNumber(obj, path, label, min);

    const value = path.split('.').reduce((current, part) => current[part], obj);

    if (!Number.isInteger(value) || value > max)
    {
        throw new Error(`[ConfigValidator] ${label}.${path} must be an integer between ${min} and ${max}`);
    }
}

function assertPath(obj, path, label)
{
    const parts = path.split('.');
    let cur = obj;

    for (const part of parts)
    {
        if (cur == null || typeof cur !== 'object' || !(part in cur))
        {
            throw new Error(`[ConfigValidator] Missing required config at ${label}.${path}`);
        }

        cur = cur[part];
    }

    if (cur == null)
    {
        throw new Error(`[ConfigValidator] Null/undefined value at ${label}.${path}`);
    }
}

function assertRange(obj, path, label, min, max)
{
    assertNumber(obj, path, label, min);
    const value = path.split('.').reduce((current, part) => current[part], obj);

    if (value > max)
    {
        throw new Error(`[ConfigValidator] ${label}.${path} must be between ${min} and ${max}`);
    }
}

function validateRings(rings, label, minSurfaceRadius)
{
    if (!rings || typeof rings !== 'object' || Array.isArray(rings))
    {
        throw new Error(`[ConfigValidator] ${label} must be a plain object`);
    }

    assertBoolean(rings, 'show', label);
    assertNumber(rings, 'innerRadius', label, Number.EPSILON);
    assertNumber(rings, 'outerRadius', label, Number.EPSILON);
    assertInteger(rings, 'textureWidth', label, 16, MAX_RING_PROFILE_WIDTH);
    assertRange(rings, 'ambient', label, 0, 1);
    assertRange(rings, 'diffuse', label, 0, 4);
    assertRange(rings, 'forwardScattering', label, 0, 4);
    assertRange(rings, 'backScattering', label, 0, 4);

    if (rings.innerRadius <= minSurfaceRadius)
    {
        throw new Error(
            `[ConfigValidator] ${label}.innerRadius must be > the maximum surface radius `
            + `multiplier (${minSurfaceRadius})`,
        );
    }

    if (rings.outerRadius <= rings.innerRadius)
    {
        throw new Error(`[ConfigValidator] ${label}.outerRadius must be > innerRadius`);
    }

    for (const angle of ['inclinationDeg', 'ascendingNodeDeg'])
    {
        if (rings[angle] !== undefined)
        {
            assertNumber(rings, angle, label);
        }
    }

    if (!Array.isArray(rings.bands))
    {
        throw new Error(`[ConfigValidator] ${label}.bands must be an array`);
    }

    if (rings.show && rings.bands.length === 0)
    {
        throw new Error(`[ConfigValidator] ${label}.bands must be non-empty when rings are enabled`);
    }

    let previousInner = -Infinity;
    let previousOuter = -Infinity;

    for (let i = 0; i < rings.bands.length; i++)
    {
        const band = rings.bands[i];
        const bandLabel = `${label}.bands[${i}]`;

        if (!band || typeof band !== 'object' || Array.isArray(band))
        {
            throw new Error(`[ConfigValidator] ${bandLabel} must be a plain object`);
        }

        assertNumber(band, 'innerRadius', bandLabel, Number.EPSILON);
        assertNumber(band, 'outerRadius', bandLabel, Number.EPSILON);
        assertRange(band, 'opacity', bandLabel, 0, 1);
        assertRange(band, 'density', bandLabel, 0, 1);
        assertNumber(band, 'edgeSoftness', bandLabel, 0);
        assertNumber(band, 'variationScale', bandLabel, Number.EPSILON);
        assertRange(band, 'variationStrength', bandLabel, 0, 1);

        if (!Number.isInteger(band.color) || band.color < 0 || band.color > 0xffffff)
        {
            throw new Error(`[ConfigValidator] ${bandLabel}.color must be a 24-bit integer color`);
        }

        if (band.innerRadius < rings.innerRadius || band.outerRadius > rings.outerRadius)
        {
            throw new Error(`[ConfigValidator] ${bandLabel} radii must be within the ring system bounds`);
        }

        if (band.outerRadius <= band.innerRadius)
        {
            throw new Error(`[ConfigValidator] ${bandLabel}.outerRadius must be > innerRadius`);
        }

        const texelWidth = (rings.outerRadius - rings.innerRadius) / rings.textureWidth;

        if (band.outerRadius - band.innerRadius < texelWidth)
        {
            throw new Error(
                `[ConfigValidator] ${bandLabel} width must be at least one profile texel `
                + `(${texelWidth})`,
            );
        }

        if (band.edgeSoftness * 2 > band.outerRadius - band.innerRadius)
        {
            throw new Error(`[ConfigValidator] ${bandLabel}.edgeSoftness must not exceed half the band width`);
        }

        if (band.innerRadius < previousInner)
        {
            throw new Error(`[ConfigValidator] ${label}.bands must be sorted by innerRadius`);
        }

        if (band.innerRadius < previousOuter)
        {
            throw new Error(`[ConfigValidator] ${label}.bands must not overlap`);
        }

        previousInner = band.innerRadius;
        previousOuter = band.outerRadius;
    }
}

function validateBody(body, label)
{
    if (!body || typeof body !== 'object')
    {
        throw new Error(`[ConfigValidator] ${label} must be a plain object`);
    }

    for (const field of BODY_REQUIRED)
    {
        if (!(field in body))
        {
            throw new Error(`[ConfigValidator] Missing required field '${field}' on ${label}`);
        }
    }

    if (typeof body.hexFrequency !== 'number' || body.hexFrequency < 2)
    {
        throw new Error(`[ConfigValidator] ${label}.hexFrequency must be a number >= 2`);
    }

    if (typeof body.maxDepth !== 'number' || body.maxDepth < 1)
    {
        throw new Error(`[ConfigValidator] ${label}.maxDepth must be a number >= 1`);
    }

    if (!body.shape || !['sphere', 'noise'].includes(body.shape.type))
    {
        throw new Error(`[ConfigValidator] ${label}.shape.type must be 'sphere' or 'noise'`);
    }

    assertInteger(body, 'seed', label, 0, 0xffffffff);
    validateTerrain(body.terrain, `${label}.terrain`);

    if (!Array.isArray(body.depthColors) || body.depthColors.length === 0)
    {
        throw new Error(`[ConfigValidator] ${label}.depthColors must be a non-empty array`);
    }

    if (body.rings !== undefined)
    {
        const maxSurfaceRadius = 1
            + body.terrain.maxDisplacement * (body.terrain.displacementMultiplier ?? 1);
        validateRings(body.rings, `${label}.rings`, maxSurfaceRadius);
    }

    function validateTerrain(terrain, label)
    {
        if (!terrain || typeof terrain !== 'object')
        {
            throw new Error(`[ConfigValidator] ${label} must be an object`);
        }

        const positive = [
            'maxDisplacement',
            'macroFrequency',
            'detailFrequency',
            'warpFrequency',
            'moistureFrequency',
            'temperatureFrequency',
            'lacunarity',
            'textureWidth',
            'shader.frequency',
        ];
        const nonNegative = [
            'macroStrength',
            'detailStrength',
            'ridgeStrength',
            'warpStrength',
            'shader.strength',
            'shader.normalStrength',
        ];

        for (const path of positive) assertNumber(terrain, path, label, Number.EPSILON);
        for (const path of nonNegative) assertNumber(terrain, path, label, 0);

        if (terrain.displacementMultiplier !== undefined)
        {
            assertNumber(terrain, 'displacementMultiplier', label, 0);
        }

        assertInteger(terrain, 'detailOctaves', label, 1, 5);
        assertInteger(terrain, 'climateOctaves', label, 3, 5);
        assertInteger(terrain, 'textureWidth', label, 1, 16384);
        assertInteger(terrain, 'shader.octaves', label, 1, 2);

        for (const path of [
            'gain',
            'latitudeInfluence',
            'biomeColorVariation',
            'biomeJitter',
        ])
        {
            assertRange(terrain, path, label, 0, 1);
        }

        const displacementMultiplier = terrain.displacementMultiplier ?? 1;

        if (displacementMultiplier > 4)
        {
            throw new Error(`[ConfigValidator] ${label}.displacementMultiplier must be <= 4`);
        }

        if (terrain.maxDisplacement * displacementMultiplier >= 0.5)
        {
            throw new Error(`[ConfigValidator] ${label} effective displacement must be < 0.5`);
        }

        if (!Array.isArray(terrain.biomes) || terrain.biomes.length === 0)
        {
            throw new Error(`[ConfigValidator] ${label}.biomes must be a non-empty array`);
        }

        if (terrain.biomes.length > MAX_BIOMES)
        {
            throw new Error(`[ConfigValidator] ${label}.biomes must contain at most ${MAX_BIOMES} entries`);
        }

        const channelBounds = [[-1, 1], [0, 1], [0, 1]];
        let regionCount = 0;
        let ruleCount = 0;

        for (let biomeIndex = 0; biomeIndex < terrain.biomes.length; biomeIndex++)
        {
            const biome = terrain.biomes[biomeIndex];
            const biomeLabel = `${label}.biomes[${biomeIndex}]`;

            if (!biome || typeof biome !== 'object')
            {
                throw new Error(`[ConfigValidator] ${biomeLabel} must be an object`);
            }

            if (!Number.isInteger(biome.color) || biome.color < 0 || biome.color > 0xffffff)
            {
                throw new Error(`[ConfigValidator] ${biomeLabel}.color must be a 24-bit integer color`);
            }

            if (!Array.isArray(biome.regions) || biome.regions.length === 0)
            {
                throw new Error(`[ConfigValidator] ${biomeLabel}.regions must be a non-empty array`);
            }

            regionCount += biome.regions.length;

            if (regionCount > MAX_BIOME_REGIONS)
            {
                throw new Error(
                    `[ConfigValidator] ${label}.biomes must contain at most ${MAX_BIOME_REGIONS} regions`,
                );
            }

            for (let regionIndex = 0; regionIndex < biome.regions.length; regionIndex++)
            {
                const region = biome.regions[regionIndex];
                const regionLabel = `${biomeLabel}.regions[${regionIndex}]`;

                if (!Array.isArray(region))
                {
                    throw new Error(`[ConfigValidator] ${regionLabel} must be an array`);
                }

                ruleCount += region.length;

                if (ruleCount > MAX_BIOME_RULES)
                {
                    throw new Error(
                        `[ConfigValidator] ${label}.biomes must contain at most ${MAX_BIOME_RULES} rules`,
                    );
                }

                for (let ruleIndex = 0; ruleIndex < region.length; ruleIndex++)
                {
                    const rule = region[ruleIndex];
                    const ruleLabel = `${regionLabel}[${ruleIndex}]`;

                    if (!rule || typeof rule !== 'object')
                    {
                        throw new Error(`[ConfigValidator] ${ruleLabel} must be an object`);
                    }

                    if (!Number.isInteger(rule.channel) || rule.channel < 0 || rule.channel > 2)
                    {
                        throw new Error(`[ConfigValidator] ${ruleLabel}.channel must be 0, 1, or 2`);
                    }

                    const [minChannel, maxChannel] = channelBounds[rule.channel];

                    if (
                        !Number.isFinite(rule.min)
                        || !Number.isFinite(rule.max)
                        || rule.min < minChannel
                        || rule.max > maxChannel
                    )
                    {
                        throw new Error(
                            `[ConfigValidator] ${ruleLabel} bounds must be within ${minChannel} and ${maxChannel}`,
                        );
                    }

                    if (rule.min > rule.max)
                    {
                        throw new Error(`[ConfigValidator] ${ruleLabel}.min must be <= max`);
                    }

                    if (!Number.isFinite(rule.blend) || rule.blend < 0)
                    {
                        throw new Error(`[ConfigValidator] ${ruleLabel}.blend must be >= 0`);
                    }
                }
            }
        }
    }

    // Validate each companion recursively.
    if (body.companions !== undefined && !Array.isArray(body.companions))
    {
        throw new Error(`[ConfigValidator] ${label}.companions must be an array`);
    }

    for (let i = 0; i < (body.companions ?? []).length; i++)
    {
        const companion = body.companions[i];
        const companionLabel = `${label}.companions[${i}]`;
        validateBody(companion, companionLabel);

        if (!companion.orbit || typeof companion.orbit !== 'object')
        {
            throw new Error(`[ConfigValidator] ${companionLabel}.orbit must be an object`);
        }
    }
}

export function validateConfigs(physical, behaviour)
{
    // physical — top-level
    if (!physical || typeof physical !== 'object')
    {
        throw new Error('[ConfigValidator] physical config must be a plain object');
    }

    if (typeof physical.cellSize !== 'number' || physical.cellSize <= 0)
    {
        throw new Error('[ConfigValidator] physical.cellSize must be a positive number');
    }

    if (!Array.isArray(physical.stars) || physical.stars.length === 0)
    {
        throw new Error('[ConfigValidator] physical.stars must be a non-empty array');
    }

    // physical.body
    validateBody(physical.body, 'physical.body');

    // behaviour — top-level required groups
    if (!behaviour || typeof behaviour !== 'object')
    {
        throw new Error('[ConfigValidator] behaviour config must be a plain object');
    }

    for (const key of BEHAVIOUR_REQUIRED)
    {
        if (!(key in behaviour) || behaviour[key] == null)
        {
            throw new Error(`[ConfigValidator] Missing required behaviour group '${key}'`);
        }
    }

    assertNumber(behaviour, 'scene.background', 'behaviour', 0);
    assertNumber(behaviour, 'scene.fov', 'behaviour', 1);
    assertNumber(behaviour, 'scene.near', 'behaviour', 0.0001);
    assertNumber(behaviour, 'scene.far', 'behaviour', 1);
    assertNumber(behaviour, 'scene.maxPixelRatio', 'behaviour', 0.1);
    assertNumber(behaviour, 'camera.crustZoom', 'behaviour', 0.01);
    assertNumber(behaviour, 'camera.zoomBaseline', 'behaviour', 0.01);
    assertNumber(behaviour, 'camera.zoomReferenceThickness', 'behaviour', 0.01);
    assertNumber(behaviour, 'camera.minDistanceFactor', 'behaviour', 0.01);
    assertNumber(behaviour, 'camera.maxDistanceFactor', 'behaviour', 0.01);
    assertNumber(behaviour, 'input.clickSlopPx', 'behaviour', 0);
    assertNumber(behaviour, 'transition.modeTransitionMs', 'behaviour', 1);
    assertNumber(behaviour, 'atmosphere.fidelity', 'behaviour', 0.01);
    assertNumber(behaviour, 'lighting.skyDistance', 'behaviour', 1);
    assertNumber(behaviour, 'lighting.nightDarkness', 'behaviour', 0);
    assertNumber(behaviour, 'starfield.count', 'behaviour', 0);
    assertNumber(behaviour, 'materials.roughness', 'behaviour', 0);
    assertNumber(behaviour, 'materials.emissiveScale', 'behaviour', 0);
    assertNumber(behaviour, 'highlights.hoverOpacity', 'behaviour', 0);
    assertBoolean(behaviour, 'slice.viewCull.enabled', 'behaviour');
    assertNumber(behaviour, 'slice.viewCull.paddingCells', 'behaviour', 0);
    assertBoolean(behaviour, 'debug.sliceProfiler.enabled', 'behaviour');
    assertInteger(behaviour, 'debug.sliceProfiler.sampleWindow', 'behaviour', 1, 10000);
    assertNumber(behaviour, 'debug.sliceProfiler.hudIntervalMs', 'behaviour', 1);
    assertPath(behaviour, 'generation.useWorker', 'behaviour');
    assertBoolean(behaviour, 'generation.useWorker', 'behaviour');
    assertInteger(behaviour, 'generation.workerTileThreshold', 'behaviour', 1, 10000000);
}
