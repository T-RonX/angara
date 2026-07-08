import * as THREE from 'three';

// ----------------------------------------------------------------------
// ShapeField — the DETERMINISTIC body-shape generator. It turns a unit
// direction into the surface radius in that direction, so the body can be an
// irregular, star-shaped asteroid instead of a perfect sphere.
//
//   * type 'sphere' → radiusScale === 1 everywhere (pixel-identical to the
//     original perfect-sphere body).
//   * type 'noise'  → a seeded fractal-Brownian-motion (fBm) heightfield
//     sampled in 3D on the direction vector: R(dir) = size · (1 + fBm), with
//     the displacement hard-clamped so a ray from the centre always hits the
//     surface exactly once (the body stays STAR-SHAPED — no overhangs).
//
// EVERYTHING random flows from `shape.seed` via a small mulberry32 PRNG — never
// Math.random — so the same `size` + `seed` ALWAYS produces the exact same
// body, on every reload and (eventually) on the backend.
//
// The noise is sampled on the 3D direction (not lon/lat), so it tiles the
// sphere seamlessly with no seam and no pole pinch.
// ----------------------------------------------------------------------
export class ShapeField
{
    #size;
    #type;
    #cfg;
    #perm;              // length-512 permutation table (seeded)
    #axis = new THREE.Vector3(1, 1, 1);
    #cache = new WeakMap(); // memoise surfaceRadius per (shared) corner vector

    constructor(shape, size)
    {
        this.#size = size;
        this.#type = shape?.type ?? 'sphere';
        this.#cfg = {
            octaves:         shape?.octaves ?? 4,
            baseFrequency:   shape?.baseFrequency ?? 1.6,
            lacunarity:      shape?.lacunarity ?? 2.0,
            gain:            shape?.gain ?? 0.5,
            amplitude:       shape?.amplitude ?? 0.12,
            maxDisplacement: shape?.maxDisplacement ?? 0.18,
        };

        const axis = shape?.axisScale ?? [1, 1, 1];
        this.#axis.set(axis[0] ?? 1, axis[1] ?? 1, axis[2] ?? 1);

        if (this.#type === 'noise')
        {
            this.#perm = this.#buildPermutation(shape?.seed ?? 0);
        }
    }

    get isSphere()
    {
        return this.#type !== 'noise';
    }

    // Lower bound on the surface radius in any direction (deepest valley).
    // Used with maxRadius to compute the effective crust thickness for camera framing.
    get minRadius()
    {
        return this.isSphere
            ? this.#size
            : this.#size * (1 - this.#cfg.maxDisplacement);
    }

    // Upper bound on the surface radius in any direction. Used as the "whole
    // body" start of the resource-mode clip sweep so no displaced peak is
    // clipped at the start of the fly-in.
    get maxRadius()
    {
        return this.isSphere
            ? this.#size
            : this.#size * (1 + this.#cfg.maxDisplacement);
    }

    // Radial scale factor `k` in a given unit direction (1 = base radius).
    radiusScale(dir)
    {
        if (this.isSphere) return 1;

        const c = this.#cfg;
        let freq = c.baseFrequency;
        let amp = 1;
        let sum = 0;
        let norm = 0;

        // Elongate first (still star-shaped) by sampling a scaled direction.
        const x = dir.x * this.#axis.x;
        const y = dir.y * this.#axis.y;
        const z = dir.z * this.#axis.z;

        for (let o = 0; o < c.octaves; o++)
        {
            sum += amp * this.#perlin3(x * freq, y * freq, z * freq);
            norm += amp;
            freq *= c.lacunarity;
            amp *= c.gain;
        }

        // Normalised fBm in ~[-1, 1] → displacement fraction, then clamp.
        const fbm = norm > 0 ? sum / norm : 0;
        const disp = THREE.MathUtils.clamp(
            fbm * c.amplitude, -c.maxDisplacement, c.maxDisplacement,
        );

        return 1 + disp;
    }

    // Absolute surface radius in a given unit direction, memoised on the shared
    // corner vector so repeated per-depth builds don't re-run the noise.
    surfaceRadius(dir)
    {
        if (this.isSphere) return this.#size;

        const hit = this.#cache.get(dir);

        if (hit !== undefined) return hit;

        const r = this.#size * this.radiusScale(dir);
        this.#cache.set(dir, r);

        return r;
    }

    // --- deterministic noise -------------------------------------------

    // mulberry32 — a tiny, fast, fully deterministic 32-bit PRNG.
    #mulberry32(seed)
    {
        let a = seed >>> 0;

        return () =>
        {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Seeded permutation table for classic Perlin noise (Fisher–Yates shuffle
    // of 0..255 with the seeded PRNG, then duplicated to length 512).
    #buildPermutation(seed)
    {
        const rng = this.#mulberry32(seed);
        const p = new Uint8Array(256);

        for (let i = 0; i < 256; i++) p[i] = i;

        for (let i = 255; i > 0; i--)
        {
            const j = Math.floor(rng() * (i + 1));
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }

        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

        return perm;
    }

    #fade(t)
    {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    #lerp(a, b, t)
    {
        return a + t * (b - a);
    }

    // Gradient at a lattice hash, standard 12-direction Perlin gradient set.
    #grad(hash, x, y, z)
    {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);

        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    // Classic 3D Perlin noise in ~[-1, 1].
    #perlin3(x, y, z)
    {
        const p = this.#perm;

        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.#fade(x);
        const v = this.#fade(y);
        const w = this.#fade(z);

        const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
        const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

        return this.#lerp(
            this.#lerp(
                this.#lerp(this.#grad(p[AA], x, y, z),     this.#grad(p[BA], x - 1, y, z), u),
                this.#lerp(this.#grad(p[AB], x, y - 1, z), this.#grad(p[BB], x - 1, y - 1, z), u),
                v,
            ),
            this.#lerp(
                this.#lerp(this.#grad(p[AA + 1], x, y, z - 1),     this.#grad(p[BA + 1], x - 1, y, z - 1), u),
                this.#lerp(this.#grad(p[AB + 1], x, y - 1, z - 1), this.#grad(p[BB + 1], x - 1, y - 1, z - 1), u),
                v,
            ),
            w,
        );
    }
}
