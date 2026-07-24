export function normalizeSeed(seed)
{
    return Number(seed) >>> 0;
}

export function childSeed(seed, name)
{
    let hash = (normalizeSeed(seed) ^ 0x811c9dc5) >>> 0;

    for (let i = 0; i < name.length; i++)
    {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b) >>> 0;

    return (hash ^ (hash >>> 16)) >>> 0;
}

export function createMulberry32(seed)
{
    let state = normalizeSeed(seed);

    return () =>
    {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function createNamedRandom(seed, name)
{
    return createMulberry32(childSeed(seed, name));
}

export function namedVector3(seed, name, scale = 256)
{
    const random = createNamedRandom(seed, name);

    return [
        (random() * 2 - 1) * scale,
        (random() * 2 - 1) * scale,
        (random() * 2 - 1) * scale,
    ];
}
