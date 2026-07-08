// ----------------------------------------------------------------------
// GoldbergGen — the THREE-FREE body generator that runs inside the body
// worker. It reproduces GoldbergSphere + GoldbergGrid + the prism geometry of
// CellGeometryFactory using only plain math and typed arrays, so it can run off
// the main thread and hand its result back as zero-copy Transferables.
//
// It is deliberately dependency-free (no THREE, no DOM) for two reasons:
//   1. a module worker has no importmap, so a bare `import 'three'` would fail;
//   2. avoiding Vector3 object churn is itself the performance win (the old
//      main-thread path allocated ~10M Vector3 at f=128).
//
// Output (all Transferable typed arrays) — see generate() for the exact shape:
//   * per-depth render geometry (positions / normals / indices + a per-cell
//     triangle-range table so a raycast face maps back to its cell), ready to
//     drop straight into a BufferGeometry with no main-thread merge;
//   * a Structure-of-Arrays description of every cell (depth, index, sides,
//     lon/lat, centroid dir, and a flat corner-ring buffer) that CellStore
//     rehydrates into lazy cell records for slicing / picking;
//   * the surface neighbour graph (CSR) for traversal.
//
// The math is ported verbatim from the existing modules so the generated body
// is pixel-identical to the synchronous path.
// ----------------------------------------------------------------------

function clamp(v, lo, hi)
{
    return v < lo ? lo : (v > hi ? hi : v);
}

// --- deterministic shape field (ported from model/ShapeField.js) -------

class ShapeSampler
{
    constructor(shape, size)
    {
        this.size = size;
        this.type = shape?.type ?? 'sphere';
        this.cfg = {
            octaves:         shape?.octaves ?? 4,
            baseFrequency:   shape?.baseFrequency ?? 1.6,
            lacunarity:      shape?.lacunarity ?? 2.0,
            gain:            shape?.gain ?? 0.5,
            amplitude:       shape?.amplitude ?? 0.12,
            maxDisplacement: shape?.maxDisplacement ?? 0.18,
        };

        const axis = shape?.axisScale ?? [1, 1, 1];
        this.axis = [axis[0] ?? 1, axis[1] ?? 1, axis[2] ?? 1];

        if (this.type === 'noise') this.perm = this.#buildPermutation(shape?.seed ?? 0);
    }

    get isSphere()
    {
        return this.type !== 'noise';
    }

    get maxRadius()
    {
        return this.isSphere ? this.size : this.size * (1 + this.cfg.maxDisplacement);
    }

    // Radius in a unit direction (x,y,z assumed normalised).
    surfaceRadius(x, y, z)
    {
        if (this.isSphere) return this.size;

        const c = this.cfg;
        let freq = c.baseFrequency;
        let amp = 1;
        let sum = 0;
        let norm = 0;

        const ax = x * this.axis[0];
        const ay = y * this.axis[1];
        const az = z * this.axis[2];

        for (let o = 0; o < c.octaves; o++)
        {
            sum += amp * this.#perlin3(ax * freq, ay * freq, az * freq);
            norm += amp;
            freq *= c.lacunarity;
            amp *= c.gain;
        }

        const fbm = norm > 0 ? sum / norm : 0;
        const disp = clamp(fbm * c.amplitude, -c.maxDisplacement, c.maxDisplacement);

        return this.size * (1 + disp);
    }

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

    #fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    #lerp(a, b, t) { return a + t * (b - a); }

    #grad(hash, x, y, z)
    {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);

        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    #perlin3(x, y, z)
    {
        const p = this.perm;
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

// --- Goldberg unit-sphere faces (ported from GoldbergSphere.js) --------

// Returns typed-array face data on the UNIT sphere:
//   { count, dirs, sides, cornerOffset, cornerXYZ, neighborOffset, neighborIndex }
function buildGoldbergFaces(frequency)
{
    const f = Math.max(1, Math.floor(frequency));
    const T = (1 + Math.sqrt(5)) / 2;

    const baseVerts = [
        [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
        [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
        [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
    ].map(([x, y, z]) =>
    {
        const l = Math.hypot(x, y, z);

        return [x / l, y / l, z / l];
    });

    const baseFaces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    const px = [], py = [], pz = [];
    const keyToIndex = new Map();
    const Q = 32767;

    const addPoint = (x, y, z) =>
    {
        const l = Math.hypot(x, y, z);
        x /= l; y /= l; z /= l;
        const key = Math.round((x + 1) * Q) * 4294967296 + Math.round((y + 1) * Q) * 65536 + Math.round((z + 1) * Q);
        const hit = keyToIndex.get(key);

        if (hit !== undefined) return hit;

        const idx = px.length;
        px.push(x); py.push(y); pz.push(z);
        keyToIndex.set(key, idx);

        return idx;
    };

    const tri = [];

    for (const [ia, ib, ic] of baseFaces)
    {
        const A = baseVerts[ia], B = baseVerts[ib], C = baseVerts[ic];
        const grid = [];

        for (let i = 0; i <= f; i++)
        {
            grid[i] = [];

            for (let j = 0; j <= f - i; j++)
            {
                const wa = f - i - j, wb = i, wc = j;
                grid[i][j] = addPoint(
                    A[0] * wa + B[0] * wb + C[0] * wc,
                    A[1] * wa + B[1] * wb + C[1] * wc,
                    A[2] * wa + B[2] * wb + C[2] * wc,
                );
            }
        }

        for (let i = 0; i < f; i++)
        {
            for (let j = 0; j < f - i; j++)
            {
                tri.push(grid[i][j], grid[i + 1][j], grid[i][j + 1]);

                if (j < f - i - 1) tri.push(grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
            }
        }
    }

    const n = px.length;
    const incident = Array.from({ length: n }, () => []);
    const nbSets = Array.from({ length: n }, () => new Set());

    for (let t = 0; t < tri.length; t += 3)
    {
        const a = tri[t], b = tri[t + 1], c = tri[t + 2];
        let cx = px[a] + px[b] + px[c];
        let cy = py[a] + py[b] + py[c];
        let cz = pz[a] + pz[b] + pz[c];
        const l = Math.hypot(cx, cy, cz);
        cx /= l; cy /= l; cz /= l;

        incident[a].push([cx, cy, cz]);
        incident[b].push([cx, cy, cz]);
        incident[c].push([cx, cy, cz]);

        nbSets[a].add(b); nbSets[a].add(c);
        nbSets[b].add(a); nbSets[b].add(c);
        nbSets[c].add(a); nbSets[c].add(b);
    }

    const dirs = new Float32Array(n * 3);
    const sides = new Uint8Array(n);
    const cornerOffset = new Uint32Array(n + 1);

    let totalCorners = 0;

    for (let p = 0; p < n; p++)
    {
        sides[p] = incident[p].length;
        totalCorners += incident[p].length;
        cornerOffset[p + 1] = totalCorners;
        dirs[p * 3] = px[p]; dirs[p * 3 + 1] = py[p]; dirs[p * 3 + 2] = pz[p];
    }

    const cornerXYZ = new Float32Array(totalCorners * 3);

    for (let p = 0; p < n; p++)
    {
        const ordered = orderRing(px[p], py[p], pz[p], incident[p]);
        let o = cornerOffset[p] * 3;

        for (const c of ordered)
        {
            cornerXYZ[o++] = c[0];
            cornerXYZ[o++] = c[1];
            cornerXYZ[o++] = c[2];
        }
    }

    const neighborOffset = new Uint32Array(n + 1);
    let totalNb = 0;

    for (let p = 0; p < n; p++)
    {
        totalNb += nbSets[p].size;
        neighborOffset[p + 1] = totalNb;
    }

    const neighborIndex = new Uint32Array(totalNb);

    for (let p = 0; p < n; p++)
    {
        let o = neighborOffset[p];
        for (const q of nbSets[p]) neighborIndex[o++] = q;
    }

    return { count: n, dirs, sides, cornerOffset, cornerXYZ, neighborOffset, neighborIndex };
}

// Order a cell's corner points CCW around the cell normal (dx,dy,dz).
function orderRing(dx, dy, dz, corners)
{
    const c0 = corners[0];
    const d0 = c0[0] * dx + c0[1] * dy + c0[2] * dz;
    let ux = c0[0] - dx * d0, uy = c0[1] - dy * d0, uz = c0[2] - dz * d0;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;

    const wx = dy * uz - dz * uy;
    const wy = dz * ux - dx * uz;
    const wz = dx * uy - dy * ux;

    return corners
        .map(c =>
        {
            const d = c[0] * dx + c[1] * dy + c[2] * dz;
            const pxp = c[0] - dx * d, pyp = c[1] - dy * d, pzp = c[2] - dz * d;

            return { c, a: Math.atan2(pxp * wx + pyp * wy + pzp * wz, pxp * ux + pyp * uy + pzp * uz) };
        })
        .sort((A, B) => A.a - B.a)
        .map(e => e.c);
}

function lonLatFromDir(x, y, z)
{
    const RAD2DEG = 180 / Math.PI;
    const lat = Math.asin(clamp(y, -1, 1)) * RAD2DEG;
    let lon = Math.atan2(z, x) * RAD2DEG;

    if (lon < 0) lon += 360;

    return [lon, lat];
}

// --- prism render geometry (ported verbatim from CellGeometryFactory) ---
//
// These reproduce CellGeometryFactory's `#appendPrismCell` / `#appendFan` /
// `#appendSideQuad` winding + normal maths EXACTLY, but operate on plain
// number-triples instead of THREE.Vector3 so they run in the worker. A ring is
// an array of [x,y,z]; the emitted geometry is pixel-identical to the
// main-thread path.

function appendFan(ring, dir, positions, normals, indices)
{
    const n = ring.length;

    let cx = 0, cy = 0, cz = 0;

    for (const p of ring) { cx += p[0]; cy += p[1]; cz += p[2]; }

    cx /= n; cy /= n; cz /= n;
    const cl = Math.hypot(cx, cy, cz) || 1;
    const dx = (cx / cl) * dir, dy = (cy / cl) * dir, dz = (cz / cl) * dir;

    const e1x = ring[1][0] - ring[0][0], e1y = ring[1][1] - ring[0][1], e1z = ring[1][2] - ring[0][2];
    const e2x = ring[2][0] - ring[0][0], e2y = ring[2][1] - ring[0][1], e2z = ring[2][2] - ring[0][2];
    const gnx = e1y * e2z - e1z * e2y;
    const gny = e1z * e2x - e1x * e2z;
    const gnz = e1x * e2y - e1y * e2x;
    const reverse = (gnx * dx + gny * dy + gnz * dz) < 0;

    const base = positions.length / 3;

    for (const p of ring)
    {
        positions.push(p[0], p[1], p[2]);
        const inv = dir / (Math.hypot(p[0], p[1], p[2]) || 1);
        normals.push(p[0] * inv, p[1] * inv, p[2] * inv);
    }

    for (let i = 1; i < n - 1; i++)
    {
        if (reverse) indices.push(base, base + i + 1, base + i);
        else         indices.push(base, base + i, base + i + 1);
    }
}

function appendSideQuad(a, b, c, d, cen, positions, normals, indices)
{
    let nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
    let ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    let nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - cen[0];
    const my = (a[1] + b[1] + c[1] + d[1]) / 4 - cen[1];
    const mz = (a[2] + b[2] + c[2] + d[2]) / 4 - cen[2];
    const flip = (nx * mx + ny * my + nz * mz) < 0;

    if (flip) { nx = -nx; ny = -ny; nz = -nz; }

    const winding = flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
    const base = positions.length / 3;

    for (const p of winding)
    {
        positions.push(p[0], p[1], p[2]);
        normals.push(nx, ny, nz);
    }

    indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
}

function appendPrismCell(outer, inner, positions, normals, indices)
{
    const n = outer.length;

    let cx = 0, cy = 0, cz = 0;

    for (const p of outer) { cx += p[0]; cy += p[1]; cz += p[2]; }

    for (const p of inner) { cx += p[0]; cy += p[1]; cz += p[2]; }

    const cen = [cx / (2 * n), cy / (2 * n), cz / (2 * n)];

    appendFan(outer, +1, positions, normals, indices);
    appendFan(inner, -1, positions, normals, indices);

    for (let k = 0; k < n; k++)
    {
        const k2 = (k + 1) % n;
        appendSideQuad(outer[k], outer[k2], inner[k2], inner[k], cen, positions, normals, indices);
    }
}

// Radius of a layer boundary (frac 1 = surface, 0 = core) in unit direction u,
// with the same anti-inversion clamp GoldbergGrid applies.
function layerRadius(ux, uy, uz, frac, coreRadius, minSurface, shapeSampler)
{
    const surface = Math.max(shapeSampler.surfaceRadius(ux, uy, uz), minSurface);

    return coreRadius + frac * (surface - coreRadius);
}

// Build the depth-0 SURFACE render geometry (full N-gon prisms, identical to
// what BodyMesh builds for depth 0) as transferable typed arrays, plus a
// per-triangle cell-index table for picking. `faces` is the buildGoldbergFaces
// output.
function buildSurfaceGeometry(faces, layerFrac, coreRadius, minSurface, shapeSampler)
{
    const { count, cornerOffset, cornerXYZ } = faces;
    const fracOuter = layerFrac[0];
    const fracInner = layerFrac[1];

    const positions = [];
    const normals = [];
    const indices = [];
    const faceCellIndex = [];

    for (let p = 0; p < count; p++)
    {
        const start = cornerOffset[p];
        const end = cornerOffset[p + 1];
        const outer = [];
        const inner = [];

        for (let c = start; c < end; c++)
        {
            const ux = cornerXYZ[c * 3], uy = cornerXYZ[c * 3 + 1], uz = cornerXYZ[c * 3 + 2];
            const ro = layerRadius(ux, uy, uz, fracOuter, coreRadius, minSurface, shapeSampler);
            const ri = layerRadius(ux, uy, uz, fracInner, coreRadius, minSurface, shapeSampler);
            outer.push([ux * ro, uy * ro, uz * ro]);
            inner.push([ux * ri, uy * ri, uz * ri]);
        }

        const triStart = indices.length / 3;
        appendPrismCell(outer, inner, positions, normals, indices);
        const triEnd = indices.length / 3;

        for (let t = triStart; t < triEnd; t++) faceCellIndex.push(p);
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
        faceCellIndex: new Uint32Array(faceCellIndex),
    };
}

export
{
    ShapeSampler,
    buildGoldbergFaces,
    buildSurfaceGeometry,
    appendPrismCell,
    orderRing,
    lonLatFromDir,
    clamp,
};
