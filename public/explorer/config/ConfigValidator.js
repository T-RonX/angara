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

function assertNumber(obj, path, label, min = -Infinity)
{
    assertPath(obj, path, label);

    const value = path.split('.').reduce((current, part) => current[part], obj);

    if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    {
        throw new Error(`[ConfigValidator] ${label}.${path} must be a finite number >= ${min}`);
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

    if (!Array.isArray(body.depthColors) || body.depthColors.length === 0)
    {
        throw new Error(`[ConfigValidator] ${label}.depthColors must be a non-empty array`);
    }

    // Validate each companion recursively.
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
    assertPath(behaviour, 'generation.useWorker', 'behaviour');
}
