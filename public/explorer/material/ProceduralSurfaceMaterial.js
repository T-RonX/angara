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
    const palette = terrain.palette.map((color, index) =>
        new THREE.Color(color).multiplyScalar(terrainField.paletteFactors[index]));
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
        seaLevel: { value: terrainField.thresholds.seaLevel },
        snowLine: { value: terrainField.thresholds.snowLine },
        dryThreshold: { value: terrainField.thresholds.dryThreshold },
        wetThreshold: { value: terrainField.thresholds.wetThreshold },
        palette0: { value: palette[0] },
        palette1: { value: palette[1] },
        palette2: { value: palette[2] },
        palette3: { value: palette[3] },
        palette4: { value: palette[4] },
        palette5: { value: palette[5] },
    });

    const material = new THREE.ShaderMaterial({
        name: `ProceduralSurface:${body.id}`,
        defines: {
            ...(terrain.shader.octaves === 2 ? { TERRAIN_TWO_OCTAVES: '1' } : {}),
        },
        uniforms,
        vertexShader: terrainVertexShader(standard.vertexShader),
        fragmentShader: terrainFragmentShader(standard.fragmentShader),
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
flat out float vTileId;
flat out float vOutwardFace;
out vec3 vTerrainPosition;`,
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vTileId = tileId;
vOutwardFace = outwardFace;
vTerrainPosition = normalize(position);`,
        );
}

function terrainFragmentShader(source)
{
    const declarations = `
flat in float vTileId;
flat in float vOutwardFace;
in vec3 vTerrainPosition;
uniform mat4 modelViewMatrix;
uniform sampler2D tileDataTexture;
uniform vec2 tileTextureSize;
uniform vec3 terrainSeedOffset;
uniform float terrainFrequency;
uniform float terrainStrength;
uniform float terrainNormalStrength;
uniform float seaLevel;
uniform float snowLine;
uniform float dryThreshold;
uniform float wetThreshold;
uniform vec3 palette0;
uniform vec3 palette1;
uniform vec3 palette2;
uniform vec3 palette3;
uniform vec3 palette4;
uniform vec3 palette5;

float terrainNoise(vec3 p)
{
    p += terrainSeedOffset;
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(
        mix(mix(fract(sin(n + 0.0) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
            mix(fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x), f.y),
        mix(mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
            mix(fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x), f.y),
        f.z
    ) * 2.0 - 1.0;
}

float terrainFbm(vec3 p)
{
    float value = terrainNoise(p);
#ifdef TERRAIN_TWO_OCTAVES
    value = (value + terrainNoise(p * 2.03) * 0.5) / 1.5;
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

vec3 resolveTerrainColor(vec4 tile)
{
    float elevation = tile.r;
    float moisture = tile.g;
    int biome = int(tile.b + 0.5);
    vec3 biomeColor = biome == 0 ? palette0
        : biome == 1 ? palette1
        : biome == 2 ? palette2
        : biome == 3 ? palette3
        : biome == 4 ? palette4
        : palette5;
    float shore = smoothstep(seaLevel - 0.06, seaLevel + 0.1, elevation);
    vec3 land = mix(palette2, palette3, smoothstep(dryThreshold, wetThreshold, moisture));
    land = mix(land, palette4, smoothstep(snowLine * 0.58, snowLine + 0.05, elevation));
    land = mix(land, palette5, smoothstep(snowLine - 0.04, snowLine + 0.18, elevation));
    vec3 continuousColor = mix(palette0, mix(palette1, land, shore), shore);

    return mix(continuousColor, biomeColor, 0.1);
}
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
if (vOutwardFace > 0.5)
{
    vec3 objectNormal = normalize(vTerrainPosition);
    vec3 objectTangent;
    vec3 objectBitangent;
    terrainBasis(objectNormal, objectTangent, objectBitangent);
    float epsilon = 0.012;
    float tangentDelta =
        terrainFbm((vTerrainPosition + objectTangent * epsilon) * terrainFrequency)
        - terrainFbm((vTerrainPosition - objectTangent * epsilon) * terrainFrequency);
    float bitangentDelta =
        terrainFbm((vTerrainPosition + objectBitangent * epsilon) * terrainFrequency)
        - terrainFbm((vTerrainPosition - objectBitangent * epsilon) * terrainFrequency);
    vec3 viewTangent = normalize(mat3(modelViewMatrix) * objectTangent);
    vec3 viewBitangent = normalize(mat3(modelViewMatrix) * objectBitangent);
    vec3 perturbation = viewTangent * tangentDelta + viewBitangent * bitangentDelta;
    normal = normalize(normal - perturbation * terrainNormalStrength / (2.0 * epsilon));
}`,
        );
}
