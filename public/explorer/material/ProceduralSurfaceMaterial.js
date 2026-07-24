import * as THREE from 'three';

export function createProceduralSurfaceMaterial({
    body,
    baseColor,
    materialConfig,
    tileTexture,
    terrainField,
})
{
    const terrain = body.terrain;
    const standard = THREE.ShaderLib.standard;
    const resolvedBiomes = terrainField.biomeModel.resolvedBiomes;
    const biomeColors = resolvedBiomes.map((biome, index) =>
        new THREE.Color(biome.color).multiplyScalar(terrainField.biomeModel.colorFactors[index]));
    const uniforms = THREE.UniformsUtils.clone(standard.uniforms);

    Object.assign(uniforms, {
        diffuse: { value: new THREE.Color(baseColor) },
        roughness: { value: materialConfig.roughness },
        metalness: { value: materialConfig.metalness },
        opacity: { value: 1 },
        tileDataTexture: { value: tileTexture.texture },
        tileTextureSize: { value: new THREE.Vector2(tileTexture.width, tileTexture.height) },
        terrainSeedOffset: { value: new THREE.Vector3(...terrainField.shaderOffsets) },
        terrainFrequency: { value: terrain.shader.frequency },
        terrainStrength: { value: terrain.shader.strength },
        terrainNormalStrength: { value: terrain.shader.normalStrength },
        biomeColors: { value: biomeColors },
    });

    const material = new THREE.ShaderMaterial({
        name: `ProceduralSurface:${body.id}`,
        defines: {
            ...(terrain.shader.octaves === 2 ? { TERRAIN_TWO_OCTAVES: '1' } : {}),
        },
        uniforms,
        vertexShader: terrainVertexShader(standard.vertexShader),
        fragmentShader: terrainFragmentShader(standard.fragmentShader, resolvedBiomes),
        lights: true,
        clipping: true,
        side: THREE.FrontSide,
    });

    material.addEventListener('dispose', () => tileTexture.dispose());

    return material;
}

function terrainVertexShader(source)
{
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
out vec3 vTerrainPosition;`,
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vTileId = tileId;
vOutwardFace = outwardFace;
vTerrainClimate = terrainClimate;
vTerrainPosition = normalize(position);`,
        );
}

function terrainFragmentShader(source, biomes)
{
    const biomeShader = buildBiomeShader(biomes);
    const declarations = `
flat in float vTileId;
flat in float vOutwardFace;
in vec3 vTerrainClimate;
in vec3 vTerrainPosition;
uniform mat4 modelViewMatrix;
uniform sampler2D tileDataTexture;
uniform vec2 tileTextureSize;
uniform vec3 terrainSeedOffset;
uniform float terrainFrequency;
uniform float terrainStrength;
uniform float terrainNormalStrength;
uniform vec3 biomeColors[${biomes.length}];

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
    float value = terrainNoise(p);
#ifdef TERRAIN_TWO_OCTAVES
    mat3 octaveRotation = mat3(
         0.0, -0.8, -0.6,
         0.8,  0.36, -0.48,
         0.6, -0.48,  0.64
    );
    value = (value + terrainNoise(octaveRotation * p * 2.03) * 0.5) / 1.5;
#endif
    return value;
}

void terrainBasis(vec3 normal, out vec3 tangent, out vec3 bitangent)
{
    float signZ = normal.z >= 0.0 ? 1.0 : -1.0;
    float factor = -1.0 / (signZ + normal.z);
    float product = normal.x * normal.y * factor;
    tangent = vec3(
        1.0 + signZ * normal.x * normal.x * factor,
        signZ * product,
        -signZ * normal.x
    );
    bitangent = vec3(
        product,
        signZ + normal.y * normal.y * factor,
        -normal.y
    );
}

vec4 readTile()
{
    int id = int(vTileId + 0.5);
    int width = int(tileTextureSize.x);
    return texelFetch(tileDataTexture, ivec2(id % width, id / width), 0);
}

${biomeShader}
`;

    return source
        .replace('#define STANDARD', `#define STANDARD\n${declarations}`)
        .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
vec4 terrainTile = readTile();
float terrainMicro = terrainFbm(vTerrainPosition * terrainFrequency);
vec3 terrainColor = resolveTerrainColor(terrainTile) * (1.0 + terrainMicro * terrainStrength);
diffuseColor.rgb = mix(diffuseColor.rgb, terrainColor, vOutwardFace);`,
        )
        .replace(
            '#include <normal_fragment_begin>',
            `#include <normal_fragment_begin>
if (vOutwardFace > 0.5 && terrainNormalStrength > 0.0)
{
    vec3 objectNormal = normalize(vTerrainPosition);
    vec3 objectTangent;
    vec3 objectBitangent;
    terrainBasis(objectNormal, objectTangent, objectBitangent);
    vec3 noisePosition = vTerrainPosition * terrainFrequency;
    float noiseEpsilon = 0.15;
    float tangentDelta =
        terrainFbm(noisePosition + objectTangent * noiseEpsilon)
        - terrainFbm(noisePosition - objectTangent * noiseEpsilon);
    float bitangentDelta =
        terrainFbm(noisePosition + objectBitangent * noiseEpsilon)
        - terrainFbm(noisePosition - objectBitangent * noiseEpsilon);
    vec3 viewTangent = normalize(mat3(modelViewMatrix) * objectTangent);
    vec3 viewBitangent = normalize(mat3(modelViewMatrix) * objectBitangent);
    vec3 perturbation = viewTangent * tangentDelta + viewBitangent * bitangentDelta;
    normal = normalize(normal - perturbation * terrainNormalStrength / (2.0 * noiseEpsilon));
}`,
        );
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
