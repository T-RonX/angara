import * as THREE from 'three';
import {
    effectiveDisplacement,
    TerrainField,
} from './texture/procedural/TerrainField.js';
import { generateTileDataWithField } from './texture/procedural/generateTileData.js';
import { TileDataTexture } from './texture/TileDataTexture.js';
import { createProceduralSurfaceMaterial } from './material/ProceduralSurfaceMaterial.js';

export async function generatePlanet(goldbergGeometry, seed, params)
{
    const position = goldbergGeometry?.getAttribute?.('position');
    const tileId = goldbergGeometry?.getAttribute?.('tileId');

    if (!(position?.array instanceof Float32Array) || position.itemSize !== 3)
    {
        throw new TypeError('generatePlanet requires a BufferGeometry with Float32 position data');
    }

    if (!(tileId?.array instanceof Float32Array) || tileId.itemSize !== 1 || tileId.count !== position.count)
    {
        throw new TypeError('generatePlanet requires one float tileId per vertex');
    }

    const terrain = params.terrain ?? params;
    const field = new TerrainField(seed, terrain, params.axisScale ?? [1, 1, 1]);
    const centroids = deriveCentroids(position.array, tileId.array);
    const tileData = generateTileDataWithField(centroids, field);
    goldbergGeometry.setAttribute(
        'terrainClimate',
        new THREE.BufferAttribute(deriveTerrainClimate(position.array, field), 2),
    );
    displacePositions(position.array, field, effectiveDisplacement(terrain));
    position.needsUpdate = true;
    goldbergGeometry.computeVertexNormals();
    goldbergGeometry.computeBoundingSphere();

    if (!goldbergGeometry.getAttribute('outwardFace'))
    {
        const outward = new Float32Array(position.count);
        outward.fill(1);
        goldbergGeometry.setAttribute('outwardFace', new THREE.BufferAttribute(outward, 1));
    }

    const tileTexture = new TileDataTexture(tileData, terrain.textureWidth);
    const material = createProceduralSurfaceMaterial({
        body: {
            id: params.id ?? 'generated',
            terrain,
        },
        baseColor: params.baseColor ?? 0xffffff,
        materialConfig: {
            roughness: params.roughness ?? 0.82,
            metalness: params.metalness ?? 0,
        },
        tileTexture,
        terrainField: field,
    });

    return { material, tileData };
}

function deriveCentroids(positions, tileIds)
{
    let maxTileId = -1;

    for (const value of tileIds)
    {
        if (!Number.isInteger(value) || value < 0)
        {
            throw new RangeError('tileId values must be non-negative integers');
        }

        maxTileId = Math.max(maxTileId, value);
    }

    const centroids = new Float32Array((maxTileId + 1) * 3);
    const counts = new Uint32Array(maxTileId + 1);

    for (let vertex = 0; vertex < tileIds.length; vertex++)
    {
        const id = tileIds[vertex];
        const source = vertex * 3;
        const target = id * 3;
        const length = Math.hypot(
            positions[source],
            positions[source + 1],
            positions[source + 2],
        ) || 1;

        centroids[target] += positions[source] / length;
        centroids[target + 1] += positions[source + 1] / length;
        centroids[target + 2] += positions[source + 2] / length;
        counts[id]++;
    }

    for (let id = 0; id < counts.length; id++)
    {
        if (counts[id] === 0) throw new RangeError(`Missing geometry vertices for tileId ${id}`);

        const offset = id * 3;
        const length = Math.hypot(
            centroids[offset],
            centroids[offset + 1],
            centroids[offset + 2],
        ) || 1;
        centroids[offset] /= length;
        centroids[offset + 1] /= length;
        centroids[offset + 2] /= length;
    }

    return centroids;
}

function displacePositions(positions, field, maxDisplacement)
{
    for (let offset = 0; offset < positions.length; offset += 3)
    {
        const radius = Math.hypot(
            positions[offset],
            positions[offset + 1],
            positions[offset + 2],
        );

        if (radius === 0) continue;

        const x = positions[offset] / radius;
        const y = positions[offset + 1] / radius;
        const z = positions[offset + 2] / radius;
        const displacedRadius = radius * (1 + field.sampleElevation(x, y, z) * maxDisplacement);
        positions[offset] = x * displacedRadius;
        positions[offset + 1] = y * displacedRadius;
        positions[offset + 2] = z * displacedRadius;
    }
}

function deriveTerrainClimate(positions, field)
{
    const climate = new Float32Array((positions.length / 3) * 2);

    for (let offset = 0, target = 0; offset < positions.length; offset += 3, target += 2)
    {
        const inverseLength = 1 / (Math.hypot(
            positions[offset],
            positions[offset + 1],
            positions[offset + 2],
        ) || 1);
        const x = positions[offset] * inverseLength;
        const y = positions[offset + 1] * inverseLength;
        const z = positions[offset + 2] * inverseLength;
        climate[target] = field.sampleElevation(x, y, z);
        climate[target + 1] = field.sampleMoisture(x, y, z);
    }

    return climate;
}
