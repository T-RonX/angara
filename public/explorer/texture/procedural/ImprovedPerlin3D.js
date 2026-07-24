export class ImprovedPerlin3D
{
    #permutation;

    constructor(random)
    {
        const source = new Uint8Array(256);

        for (let i = 0; i < source.length; i++) source[i] = i;

        for (let i = source.length - 1; i > 0; i--)
        {
            const j = Math.floor(random() * (i + 1));
            const value = source[i];
            source[i] = source[j];
            source[j] = value;
        }

        this.#permutation = new Uint8Array(512);

        for (let i = 0; i < this.#permutation.length; i++)
        {
            this.#permutation[i] = source[i & 255];
        }
    }

    sample(x, y, z)
    {
        const floorX = Math.floor(x);
        const floorY = Math.floor(y);
        const floorZ = Math.floor(z);
        const X = floorX & 255;
        const Y = floorY & 255;
        const Z = floorZ & 255;
        const px = x - floorX;
        const py = y - floorY;
        const pz = z - floorZ;
        const u = fade(px);
        const v = fade(py);
        const w = fade(pz);
        const p = this.#permutation;
        const A = p[X] + Y;
        const AA = p[A] + Z;
        const AB = p[A + 1] + Z;
        const B = p[X + 1] + Y;
        const BA = p[B] + Z;
        const BB = p[B + 1] + Z;

        return lerp(
            lerp(
                lerp(gradient(p[AA], px, py, pz), gradient(p[BA], px - 1, py, pz), u),
                lerp(gradient(p[AB], px, py - 1, pz), gradient(p[BB], px - 1, py - 1, pz), u),
                v,
            ),
            lerp(
                lerp(gradient(p[AA + 1], px, py, pz - 1), gradient(p[BA + 1], px - 1, py, pz - 1), u),
                lerp(gradient(p[AB + 1], px, py - 1, pz - 1), gradient(p[BB + 1], px - 1, py - 1, pz - 1), u),
                v,
            ),
            w,
        );
    }
}

function fade(value)
{
    return value * value * value * (value * (value * 6 - 15) + 10);
}

function lerp(a, b, amount)
{
    return a + amount * (b - a);
}

function gradient(hash, x, y, z)
{
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);

    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
