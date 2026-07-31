import * as THREE from 'three';
import { ringShadowShader } from '../ring/RingShader.js';

const STRUCTURE_TYPES = Object.freeze({
    none: 0,
    waves: 1,
    dunes: 2,
    craters: 3,
    ridges: 4,
    cracks: 5,
    ice: 6,
    strata: 7,
});

export function createProceduralSurfaceMaterial({
    body,
    baseColor,
    materialConfig,
    tileTexture,
    terrainField,
    ringShadow = null,
})
{
    const terrain = body.terrain;
    const detailFade = materialConfig.procedural ?? {
        detailFadeStart: 0.35,
        detailFadeEnd: 1.6,
        normalFadeStart: 0.08,
        normalFadeEnd: 0.32,
    };
    const standard = THREE.ShaderLib.standard;
    const resolvedBiomes = terrainField.biomeModel.resolvedBiomes;
    const biomeColors = resolvedBiomes.map((biome, index) =>
        new THREE.Color(biome.color).multiplyScalar(terrainField.biomeModel.colorFactors[index]));
    const biomeSurfaceDetail = resolvedBiomes.map(biome => new THREE.Vector4(
        biome.surface.macroNormalMultiplier,
        biome.surface.microNormalMultiplier,
        biome.surface.microFrequencyMultiplier,
        biome.surface.albedoVariation,
    ));
    const biomeStructures = resolvedBiomes.map(biome => new THREE.Vector4(
        biome.surface.structure.frequency,
        biome.surface.structure.strength,
        STRUCTURE_TYPES[biome.surface.structure.type],
        biome.surface.roughnessBias,
    ));
    const uniforms = THREE.UniformsUtils.clone(standard.uniforms);

    Object.assign(uniforms, {
        diffuse: { value: new THREE.Color(baseColor) },
        roughness: { value: materialConfig.roughness },
        metalness: { value: materialConfig.metalness },
        opacity: { value: 1 },
        tileDataTexture: { value: tileTexture.texture },
        tileTextureSize: { value: new THREE.Vector2(tileTexture.width, tileTexture.height) },
        terrainSeedOffset: { value: new THREE.Vector3(...terrainField.shaderOffsets) },
        surfaceMacroFrequency: { value: terrain.surface.macroFrequency },
        surfaceMicroFrequency: { value: terrain.surface.microFrequency },
        surfaceAlbedoVariation: { value: terrain.surface.albedoVariation },
        surfaceMacroNormalStrength: { value: terrain.surface.macroNormalStrength },
        surfaceMicroNormalStrength: { value: terrain.surface.microNormalStrength },
        surfaceRoughnessRange: {
            value: new THREE.Vector2(
                terrain.surface.roughnessMin,
                terrain.surface.roughnessMax,
            ),
        },
        surfaceSlopeStrength: { value: terrain.surface.slopeStrength },
        surfaceCellTintStrength: { value: terrain.surface.cellTintStrength },
        surfaceCellRoughnessStrength: { value: terrain.surface.cellRoughnessStrength },
        surfaceDetailFade: {
            value: new THREE.Vector2(
                detailFade.detailFadeStart,
                detailFade.detailFadeEnd,
            ),
        },
        surfaceNormalFade: {
            value: new THREE.Vector2(
                detailFade.normalFadeStart,
                detailFade.normalFadeEnd,
            ),
        },
        biomeColors: { value: biomeColors },
        biomeSurfaceDetail: { value: biomeSurfaceDetail },
        biomeStructures: { value: biomeStructures },
    });

    if (ringShadow)
    {
        Object.assign(uniforms, ringShadow);
    }

    const material = new THREE.ShaderMaterial({
        name: `ProceduralSurface:${body.id}`,
        defines: {
            [`TERRAIN_PROFILE_${terrain.profile.toUpperCase()}`]: '1',
            ...(ringShadow ? {
                USE_PLANETARY_RINGS: '1',
                RING_SUN_COUNT: ringShadow.uRingSunDirection.value.length,
            } : {}),
        },
        uniforms,
        vertexShader: terrainVertexShader(standard.vertexShader, ringShadow !== null),
        fragmentShader: terrainFragmentShader(
            standard.fragmentShader,
            resolvedBiomes,
            ringShadow !== null,
        ),
        lights: true,
        clipping: true,
        side: THREE.FrontSide,
    });

    material.addEventListener('dispose', () => tileTexture.dispose());

    return material;
}

function terrainVertexShader(source, hasRings)
{
    const ringDeclaration = hasRings ? '\nout vec3 vRingWorldPosition;' : '';
    const ringAssignment = hasRings
        ? '\nvRingWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;'
        : '';

    return source
        .replace(
            '#define STANDARD',
            `#define STANDARD
attribute float tileId;
attribute float outwardFace;
attribute vec3 terrainClimate;
flat out float vTileId;
flat out float vOutwardFace;
out vec3 vTerrainClimate;
out vec3 vTerrainPosition;
out vec3 vTerrainGeometryNormal;
out vec3 vTerrainObjectPosition;${ringDeclaration}`,
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vTileId = tileId;
vOutwardFace = outwardFace;
vTerrainClimate = terrainClimate;
vTerrainPosition = normalize(position);
vTerrainGeometryNormal = normalize(normal);
vTerrainObjectPosition = position;${ringAssignment}`,
        );
}

function terrainFragmentShader(source, biomes, hasRings)
{
    const biomeShader = buildBiomeShader(biomes);
    const ringDeclarations = hasRings
        ? `
in vec3 vRingWorldPosition;
${ringShadowShader}`
        : '';
    const ringDirectWrapper = hasRings
        ? `
#include <lights_physical_pars_fragment>

void RE_Direct_Ring(
    const in IncidentLight directLight,
    const in vec3 geometryPosition,
    const in vec3 geometryNormal,
    const in vec3 geometryViewDir,
    const in vec3 geometryClearcoatNormal,
    const in PhysicalMaterial material,
    inout ReflectedLight reflectedLight
)
{
    IncidentLight transmittedLight = directLight;

    if (vOutwardFace > 0.5)
    {
        vec3 worldLightDirection = normalize(
            transpose(mat3(viewMatrix)) * directLight.direction
        );
        transmittedLight.color *= ringDirectTransmittance(
            vRingWorldPosition,
            worldLightDirection
        );
    }

    RE_Direct_Physical(
        transmittedLight,
        geometryPosition,
        geometryNormal,
        geometryViewDir,
        geometryClearcoatNormal,
        material,
        reflectedLight
    );
}

#undef RE_Direct
#define RE_Direct RE_Direct_Ring`
        : null;
    const declarations = `
flat in float vTileId;
flat in float vOutwardFace;
in vec3 vTerrainClimate;
in vec3 vTerrainPosition;
in vec3 vTerrainGeometryNormal;
in vec3 vTerrainObjectPosition;
uniform mat4 modelViewMatrix;
uniform sampler2D tileDataTexture;
uniform vec2 tileTextureSize;
uniform vec3 terrainSeedOffset;
uniform float surfaceMacroFrequency;
uniform float surfaceMicroFrequency;
uniform float surfaceAlbedoVariation;
uniform float surfaceMacroNormalStrength;
uniform float surfaceMicroNormalStrength;
uniform vec2 surfaceRoughnessRange;
uniform float surfaceSlopeStrength;
uniform float surfaceCellTintStrength;
uniform float surfaceCellRoughnessStrength;
uniform vec2 surfaceDetailFade;
uniform vec2 surfaceNormalFade;
uniform vec3 biomeColors[${biomes.length}];
uniform vec4 biomeSurfaceDetail[${biomes.length}];
uniform vec4 biomeStructures[${biomes.length}];
${ringDeclarations}

vec3 terrainGradient(vec3 lattice)
{
    vec3 hashed = fract(lattice * vec3(0.1031, 0.1030, 0.0973));
    hashed += dot(hashed, hashed.yxz + 33.33);
    vec3 gradient = fract((hashed.xxy + hashed.yxx) * hashed.zyx) * 2.0 - 1.0;

    return gradient * inversesqrt(max(dot(gradient, gradient), 0.0001));
}

float terrainNoise(vec3 p)
{
    p += terrainSeedOffset;
    vec3 lattice = floor(p);
    vec3 offset = fract(p);
    vec3 blend = offset * offset * offset * (offset * (offset * 6.0 - 15.0) + 10.0);

    return mix(
        mix(
            mix(
                dot(terrainGradient(lattice + vec3(0.0, 0.0, 0.0)), offset),
                dot(terrainGradient(lattice + vec3(1.0, 0.0, 0.0)), offset - vec3(1.0, 0.0, 0.0)),
                blend.x
            ),
            mix(
                dot(terrainGradient(lattice + vec3(0.0, 1.0, 0.0)), offset - vec3(0.0, 1.0, 0.0)),
                dot(terrainGradient(lattice + vec3(1.0, 1.0, 0.0)), offset - vec3(1.0, 1.0, 0.0)),
                blend.x
            ),
            blend.y
        ),
        mix(
            mix(
                dot(terrainGradient(lattice + vec3(0.0, 0.0, 1.0)), offset - vec3(0.0, 0.0, 1.0)),
                dot(terrainGradient(lattice + vec3(1.0, 0.0, 1.0)), offset - vec3(1.0, 0.0, 1.0)),
                blend.x
            ),
            mix(
                dot(terrainGradient(lattice + vec3(0.0, 1.0, 1.0)), offset - vec3(0.0, 1.0, 1.0)),
                dot(terrainGradient(lattice + vec3(1.0, 1.0, 1.0)), offset - vec3(1.0, 1.0, 1.0)),
                blend.x
            ),
            blend.y
        ),
        blend.z
    ) * 1.5;
}

float terrainFbm(vec3 p)
{
    mat3 octaveRotation = mat3(
         0.0, -0.8, -0.6,
         0.8,  0.36, -0.48,
         0.6, -0.48,  0.64
    );
    return (terrainNoise(p) + terrainNoise(octaveRotation * p * 2.03 + 17.7) * 0.5) / 1.5;
}

float terrainTileBias(float tileId)
{
    float seeded = tileId * 12.9898 + dot(terrainSeedOffset, vec3(0.127, 0.311, 0.743));

    return fract(sin(seeded) * 43758.5453) * 2.0 - 1.0;
}

float terrainStructureSignal(vec3 position, vec4 structure)
{
    float frequency = structure.x;
    float type = structure.z;
    vec3 p = position * frequency;
    float noise = terrainFbm(p + vec3(53.2, 17.9, 31.6));

    if (type < 0.5) return 0.0;
    if (type < 1.5) return terrainFbm(p.zxy * 0.8) * 0.4;
    if (type < 2.5)
    {
        return sin((p.x + p.z * 0.42 + noise * 0.8) * 6.28318) * 0.5 + noise * 0.25;
    }
    if (type < 3.5)
    {
        float radius = abs(noise);
        return smoothstep(0.22, 0.38, radius) - smoothstep(0.38, 0.54, radius) * 0.7;
    }
    if (type < 4.5) return 1.0 - abs(noise) * 2.0;
    if (type < 5.5) return 1.0 - smoothstep(0.02, 0.16, abs(noise));
    if (type < 6.5) return (1.0 - abs(noise)) * 0.85;

    return sin((p.y + noise * 0.35) * 6.28318) * 0.5 + noise * 0.2;
}

vec3 terrainProfileColor(
    vec3 base,
    vec4 tile,
    float macroNoise,
    float microNoise,
    float slope
)
{
    float luminance = dot(base, vec3(0.2126, 0.7152, 0.0722));
    vec3 rock = mix(base, vec3(luminance * 0.76), surfaceSlopeStrength);
    vec3 color = mix(base, rock, slope * surfaceSlopeStrength);

#if defined(TERRAIN_PROFILE_BARREN)
    float ejecta = smoothstep(0.42, 0.82, abs(macroNoise));
    color = mix(color, color * vec3(1.12, 1.08, 1.02), ejecta * 0.28);
#elif defined(TERRAIN_PROFILE_ARID)
    float strata = sin((vTerrainPosition.y + macroNoise * 0.08) * 72.0);
    color *= 1.0 + strata * 0.055 + (tile.w - 0.5) * 0.07;
#elif defined(TERRAIN_PROFILE_GLACIAL)
    float cold = 1.0 - tile.w;
    float ice = smoothstep(0.35, 0.82, cold + max(tile.x, 0.0) * 0.45);
    color = mix(color, vec3(0.78, 0.9, 0.97), ice * 0.42);
    color *= 1.0 - pow(1.0 - abs(macroNoise), 4.0) * 0.12;
#else
    float snow = smoothstep(0.72, 1.02, (1.0 - tile.w) + max(tile.x, 0.0) * 0.65);
    float vegetation = tile.y * smoothstep(-0.05, 0.42, tile.x);
    color *= vec3(1.0 - vegetation * 0.045, 1.0 + vegetation * 0.035, 1.0 - vegetation * 0.025);
    color = mix(color, vec3(0.82, 0.86, 0.88), snow * 0.52);
#endif

    color *= 1.0 + macroNoise * surfaceAlbedoVariation;
    color *= 1.0 + microNoise * surfaceAlbedoVariation * 0.28;

    return max(color, vec3(0.0));
}

vec3 terrainPerturbedNormal(vec3 baseNormal, float height)
{
    vec3 sigmaX = dFdx(vTerrainPosition);
    vec3 sigmaY = dFdy(vTerrainPosition);
    vec3 r1 = cross(sigmaY, baseNormal);
    vec3 r2 = cross(baseNormal, sigmaX);
    float determinant = dot(sigmaX, r1);
    vec3 gradient = sign(determinant)
        * (dFdx(height) * r1 + dFdy(height) * r2);

    return normalize(abs(determinant) * baseNormal - gradient);
}

vec3 terrainLandformNormal()
{
    vec3 landformNormal = normalize(cross(
        dFdx(vTerrainObjectPosition),
        dFdy(vTerrainObjectPosition)
    ));

    return dot(landformNormal, vTerrainPosition) < 0.0
        ? -landformNormal
        : landformNormal;
}

vec4 readTile()
{
    int id = int(vTileId + 0.5);
    int width = int(tileTextureSize.x);
    return texelFetch(tileDataTexture, ivec2(id % width, id / width), 0);
}

${biomeShader}
`;

    let shader = source
        .replace('#define STANDARD', `#define STANDARD\n${declarations}`)
        .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
vec4 terrainTile = readTile();
float terrainMacro = terrainFbm(vTerrainPosition * surfaceMacroFrequency);
vec4 terrainBiomeDetail = resolveBiomeSurfaceDetail(terrainTile);
vec4 terrainBiomeStructure = resolveBiomeStructure(terrainTile);
float terrainMicroFrequency = surfaceMicroFrequency * terrainBiomeDetail.z;
float terrainMicro = terrainFbm(
    vTerrainPosition.zxy * terrainMicroFrequency + vec3(23.1, 41.7, 11.3)
);
float terrainFootprint = length(fwidth(vTerrainPosition)) * terrainMicroFrequency;
float terrainDetailAttenuation = 1.0 - smoothstep(
    surfaceDetailFade.x,
    surfaceDetailFade.y,
    terrainFootprint
);
float terrainStructureSignal = terrainStructureSignal(
    vTerrainPosition,
    terrainBiomeStructure
);
float terrainStructureFootprint = length(fwidth(vTerrainPosition))
    * terrainBiomeStructure.x;
float terrainNormalAttenuation = 1.0 - smoothstep(
    surfaceNormalFade.x,
    surfaceNormalFade.y,
    max(terrainFootprint, terrainStructureFootprint)
);
vec3 terrainMacroNormal = terrainLandformNormal();
float terrainSlope = sqrt(clamp(
    1.0 - dot(normalize(vTerrainPosition), terrainMacroNormal),
    0.0,
    1.0
));
float terrainCellBias = terrainTileBias(vTileId);
vec3 terrainColor = terrainProfileColor(
    resolveTerrainColor(terrainTile),
    terrainTile,
    terrainMacro,
    terrainMicro * terrainDetailAttenuation,
    terrainSlope
);
terrainColor *= 1.0 + terrainStructureSignal * terrainBiomeStructure.y * 0.16;
terrainColor *= 1.0 + terrainCellBias * surfaceCellTintStrength;
diffuseColor.rgb = mix(diffuseColor.rgb, terrainColor, vOutwardFace);`,
        )
        .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
if (vOutwardFace > 0.5)
{
    float terrainRoughnessSignal = clamp(
        0.5
        + terrainMacro * 0.24
        - terrainMicro * terrainDetailAttenuation * 0.12
        + terrainSlope * surfaceSlopeStrength * 0.28,
        0.0,
        1.0
    );
#ifdef TERRAIN_PROFILE_GLACIAL
    terrainRoughnessSignal *= 0.72 + terrainTile.w * 0.28;
#endif
    roughnessFactor = clamp(
        mix(surfaceRoughnessRange.x, surfaceRoughnessRange.y, terrainRoughnessSignal)
        + terrainCellBias * surfaceCellRoughnessStrength
        + terrainBiomeStructure.w,
        surfaceRoughnessRange.x,
        surfaceRoughnessRange.y
    );
}`,
        )
        .replace(
            '#include <normal_fragment_begin>',
            `#include <normal_fragment_begin>
if (
    vOutwardFace > 0.5
    && (surfaceMacroNormalStrength > 0.0 || surfaceMicroNormalStrength > 0.0)
)
{
    float terrainRelief = (
        terrainMacro * surfaceMacroNormalStrength * terrainBiomeDetail.x
        + terrainMicro * surfaceMicroNormalStrength
            * terrainBiomeDetail.y * terrainDetailAttenuation
        + terrainStructureSignal * terrainBiomeStructure.y
            * surfaceMacroNormalStrength * 0.35
    ) * terrainNormalAttenuation;
    vec3 baseObjectNormal = normalize(mix(
        normalize(vTerrainGeometryNormal),
        terrainMacroNormal,
        surfaceSlopeStrength * 0.45
    ));
    vec3 objectNormal = terrainPerturbedNormal(
        baseObjectNormal,
        terrainRelief
    );
    normal = normalize(mat3(modelViewMatrix) * objectNormal);
}`,
        );

        if (ringDirectWrapper)
        {
            shader = shader.replace(
                '#include <lights_physical_pars_fragment>',
                ringDirectWrapper,
            );
        }

        return shader;
    }

function buildBiomeShader(biomes)
{
    const channels = ['vTerrainClimate.x', 'vTerrainClimate.y', 'vTerrainClimate.z'];
    const lines = [
        'vec3 resolveTerrainColor(vec4 tile)',
        '{',
        '    vec3 hardColor = biomeColors[0];',
    ];

    for (let biome = 1; biome < biomes.length; biome++)
    {
        lines.push(
            `    if (tile.z >= ${glslNumber(biome - 0.5)}) hardColor = biomeColors[${biome}];`,
        );
    }

    lines.push(
        '    vec3 blendedColor = vec3(0.0);',
        '    float remainingWeight = 1.0;',
    );

    for (let biome = 0; biome < biomes.length; biome++)
    {
        const regions = biomes[biome].regions.map(region =>
        {
            if (region.length === 0) return '1.0';

            return combine(
                region.map(rule => ruleInfluence(rule, channels[rule.channel])),
                'min',
            );
        });
        const influence = combine(regions, 'max');

        lines.push(
            `    float biomeWeight${biome} = clamp(${influence}, 0.0, 1.0);`,
            `    blendedColor += biomeColors[${biome}] * remainingWeight * biomeWeight${biome};`,
            `    remainingWeight *= 1.0 - biomeWeight${biome};`,
        );
    }

    lines.push(
        '    return blendedColor + hardColor * remainingWeight;',
        '}',
        '',
        'vec4 resolveBiomeSurfaceDetail(vec4 tile)',
        '{',
        '    vec4 detail = biomeSurfaceDetail[0];',
    );

    for (let biome = 1; biome < biomes.length; biome++)
    {
        lines.push(
            `    if (tile.z >= ${glslNumber(biome - 0.5)}) detail = biomeSurfaceDetail[${biome}];`,
        );
    }

    lines.push(
        '    return detail;',
        '}',
        '',
        'vec4 resolveBiomeStructure(vec4 tile)',
        '{',
        '    vec4 structure = biomeStructures[0];',
    );

    for (let biome = 1; biome < biomes.length; biome++)
    {
        lines.push(
            `    if (tile.z >= ${glslNumber(biome - 0.5)}) structure = biomeStructures[${biome}];`,
        );
    }

    lines.push(
        '    return structure;',
        '}',
    );

    return lines.join('\n');
}

function ruleInfluence(rule, value)
{
    const min = glslNumber(rule.min);
    const max = glslNumber(rule.max);

    if (rule.blend === 0)
    {
        return `(step(${min}, ${value}) * step(${value}, ${max}))`;
    }

    const blend = glslNumber(rule.blend);

    return `(`
        + `smoothstep(${min} - ${blend}, ${min}, ${value})`
        + ` * (1.0 - smoothstep(${max}, ${max} + ${blend}, ${value}))`
        + `)`;
}

function combine(expressions, operation)
{
    if (expressions.length === 1) return expressions[0];

    return expressions.slice(1).reduce(
        (combined, expression) => `${operation}(${combined}, ${expression})`,
        expressions[0],
    );
}

function glslNumber(value)
{
    return Number.isInteger(value) ? `${value}.0` : String(value);
}
