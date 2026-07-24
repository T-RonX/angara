import { TerrainField } from './TerrainField.js';

export function generateTileData(centroids, seed, params, axisScale = [1, 1, 1])
{
    const field = new TerrainField(seed, params, axisScale);

    return generateTileDataWithField(centroids, field);
}

export function generateTileDataWithField(centroids, field)
{
    if (!(centroids instanceof Float32Array) || centroids.length % 3 !== 0)
    {
        throw new TypeError('centroids must be a Float32Array of packed xyz directions');
    }

    const count = centroids.length / 3;
    const packed = new Float32Array(count * 4);

    for (let cellIndex = 0; cellIndex < count; cellIndex++)
    {
        const source = cellIndex * 3;
        const target = cellIndex * 4;
        const x = centroids[source];
        const y = centroids[source + 1];
        const z = centroids[source + 2];
        const elevation = field.sampleElevation(x, y, z);
        const moisture = field.sampleMoisture(x, y, z);
        const temperature = field.sampleTemperature(x, y, z, elevation);
        const biome = field.classifyBiome(elevation, moisture, temperature);

        packed[target] = elevation;
        packed[target + 1] = moisture;
        packed[target + 2] = biome;
        packed[target + 3] = temperature;
    }

    return Object.freeze({ count, packed });
}
