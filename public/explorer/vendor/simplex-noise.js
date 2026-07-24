/*
 * simplex-noise 4.0.3, browser ESM distribution (3D export only).
 * Copyright (c) 2024 Jonas Wagner. MIT License.
 * https://github.com/jwagner/simplex-noise.js
 */
const F3 = 1 / 3;
const G3 = 1 / 6;
const grad3 = new Float64Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

const fastFloor = x => Math.floor(x) | 0;

export function createNoise3D(random)
{
    if (typeof random !== 'function')
    {
        throw new TypeError('createNoise3D requires a seeded random function');
    }

    const perm = buildPermutationTable(random);
    const permGrad3x = new Float64Array(perm).map(v => grad3[(v % 12) * 3]);
    const permGrad3y = new Float64Array(perm).map(v => grad3[(v % 12) * 3 + 1]);
    const permGrad3z = new Float64Array(perm).map(v => grad3[(v % 12) * 3 + 2]);

    return function noise3D(x, y, z)
    {
        let n0;
        let n1;
        let n2;
        let n3;
        const s = (x + y + z) * F3;
        const i = fastFloor(x + s);
        const j = fastFloor(y + s);
        const k = fastFloor(z + s);
        const t = (i + j + k) * G3;
        const x0 = x - (i - t);
        const y0 = y - (j - t);
        const z0 = z - (k - t);
        let i1;
        let j1;
        let k1;
        let i2;
        let j2;
        let k2;

        if (x0 >= y0)
        {
            if (y0 >= z0)
            {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 1; k2 = 0;
            }
            else if (x0 >= z0)
            {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 0; k2 = 1;
            }
            else
            {
                i1 = 0; j1 = 0; k1 = 1;
                i2 = 1; j2 = 0; k2 = 1;
            }
        }
        else if (y0 < z0)
        {
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 0; j2 = 1; k2 = 1;
        }
        else if (x0 < z0)
        {
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 0; j2 = 1; k2 = 1;
        }
        else
        {
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        }

        const x1 = x0 - i1 + G3;
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2 * G3;
        const y2 = y0 - j2 + 2 * G3;
        const z2 = z0 - k2 + 2 * G3;
        const x3 = x0 - 1 + 3 * G3;
        const y3 = y0 - 1 + 3 * G3;
        const z3 = z0 - 1 + 3 * G3;
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;

        let c = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (c < 0) n0 = 0;
        else
        {
            const gi = ii + perm[jj + perm[kk]];
            c *= c;
            n0 = c * c * (
                permGrad3x[gi] * x0 + permGrad3y[gi] * y0 + permGrad3z[gi] * z0
            );
        }

        c = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (c < 0) n1 = 0;
        else
        {
            const gi = ii + i1 + perm[jj + j1 + perm[kk + k1]];
            c *= c;
            n1 = c * c * (
                permGrad3x[gi] * x1 + permGrad3y[gi] * y1 + permGrad3z[gi] * z1
            );
        }

        c = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (c < 0) n2 = 0;
        else
        {
            const gi = ii + i2 + perm[jj + j2 + perm[kk + k2]];
            c *= c;
            n2 = c * c * (
                permGrad3x[gi] * x2 + permGrad3y[gi] * y2 + permGrad3z[gi] * z2
            );
        }

        c = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (c < 0) n3 = 0;
        else
        {
            const gi = ii + 1 + perm[jj + 1 + perm[kk + 1]];
            c *= c;
            n3 = c * c * (
                permGrad3x[gi] * x3 + permGrad3y[gi] * y3 + permGrad3z[gi] * z3
            );
        }

        return 32 * (n0 + n1 + n2 + n3);
    };
}

export function buildPermutationTable(random)
{
    const p = new Uint8Array(512);

    for (let i = 0; i < 256; i++) p[i] = i;

    for (let i = 0; i < 255; i++)
    {
        const r = i + ~~(random() * (256 - i));
        const aux = p[i];
        p[i] = p[r];
        p[r] = aux;
    }

    for (let i = 256; i < 512; i++) p[i] = p[i - 256];

    return p;
}
