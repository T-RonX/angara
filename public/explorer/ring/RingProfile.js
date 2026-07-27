function hashUnit(seed, value)
{
    let hash = (seed ^ Math.imul(value, 0x9e3779b1)) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b) >>> 0;
    hash ^= hash >>> 16;

    return hash / 4294967295;
}

function valueNoise(seed, coordinate)
{
    const cell = Math.floor(coordinate);
    const fraction = coordinate - cell;
    const smooth = fraction * fraction * (3 - 2 * fraction);

    return hashUnit(seed, cell) * (1 - smooth) + hashUnit(seed, cell + 1) * smooth;
}

function smoothstep(edge0, edge1, value)
{
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));

    return t * t * (3 - 2 * t);
}

export function buildRingProfile(rings, seed)
{
    const data = new Uint8Array(rings.textureWidth * 4);
    const span = rings.outerRadius - rings.innerRadius;

    for (let texel = 0; texel < rings.textureWidth; texel++)
    {
        const texelInner = rings.innerRadius + texel / rings.textureWidth * span;
        const texelOuter = rings.innerRadius + (texel + 1) / rings.textureWidth * span;
        const bandIndex = rings.bands.findIndex(band =>
            band.outerRadius > texelInner && band.innerRadius < texelOuter);

        if (bandIndex < 0) continue;

        const band = rings.bands[bandIndex];
        const overlapInner = Math.max(texelInner, band.innerRadius);
        const overlapOuter = Math.min(texelOuter, band.outerRadius);
        const coverage = (overlapOuter - overlapInner) / (texelOuter - texelInner);
        const radius = (overlapInner + overlapOuter) * 0.5;
        const edgeDistance = Math.min(
            radius - band.innerRadius,
            band.outerRadius - radius,
        );
        const edge = band.edgeSoftness > 0
            ? smoothstep(0, band.edgeSoftness, edgeDistance)
            : 1;
        const bandSeed = (Number(seed) + Math.imul(bandIndex + 1, 0x6d2b79f5)) >>> 0;
        const noise = valueNoise(bandSeed, radius * band.variationScale);
        const variation = 1 + (noise * 2 - 1) * band.variationStrength;
        const brightness = 1 + (noise * 2 - 1) * band.variationStrength * 0.12;
        const offset = texel * 4;

        data[offset] = colorChannel(band.color, 16, brightness);
        data[offset + 1] = colorChannel(band.color, 8, brightness);
        data[offset + 2] = colorChannel(band.color, 0, brightness);
        data[offset + 3] = Math.round(
            255 * Math.max(0, Math.min(
                1,
                band.opacity * band.density * edge * variation * coverage,
            )),
        );
    }

    return {
        data,
        width: rings.textureWidth,
        innerRadius: rings.innerRadius,
        outerRadius: rings.outerRadius,
    };
}

function colorChannel(color, shift, brightness)
{
    return Math.round(Math.max(0, Math.min(255, ((color >> shift) & 0xff) * brightness)));
}
