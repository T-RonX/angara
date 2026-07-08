import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergSphere — builds a Goldberg polyhedron (the DUAL of a subdivided
// icosahedron): mostly hexagonal cells plus exactly 12 pentagonal cells at
// the original icosahedron vertices, with NO poles.
//
// It subdivides each icosahedral triangle into a frequency-`f` barycentric
// grid, projects the points to the unit sphere, then takes the dual: every
// geodesic vertex becomes one cell whose corners are the centroids of the
// triangles that surround it. Valence-5 vertices give pentagons (12 of them),
// valence-6 vertices give hexagons.
//
// Output: an array of face records, each a pure-geometry description of a
// surface cell on the UNIT sphere:
//
//   { index, dir, corners[], neighbors[], sides }
//
//     index     — stable cell index (position in the array)
//     dir       — unit Vector3 of the cell centre (the geodesic vertex)
//     corners   — ordered unit Vector3[] (CCW seen from outside), length = sides
//     neighbors — indices of edge-adjacent cells
//     sides     — 5 (pentagon) or 6 (hexagon)
//
// It is topology-private data on the unit sphere; GoldbergGrid scales it into
// the per-depth prism cells the rest of the renderer consumes.
// ----------------------------------------------------------------------
export class GoldbergSphere
{
    faces = [];

    constructor(frequency)
    {
        const f = Math.max(1, Math.floor(frequency));

        const { points, triangles } = this.#geodesic(f);
        this.#buildDual(points, triangles);
    }

    // Rehydrate a GoldbergSphere from the worker's transferable face bundle
    // (see worker/GoldbergGen.js buildGoldbergFaces) WITHOUT re-running the
    // expensive geodesic + dual + ordering compute — that already happened off
    // the main thread. The produced `faces` are shape-identical to the
    // synchronous path: { index, dir, corners, neighbors, sides }. The heavy
    // corner Vector3 rings are exposed LAZILY (materialised on first read from
    // the packed cornerXYZ buffer) so cells nothing ever touches cost nothing.
    static fromFaceData(data)
    {
        const sphere = Object.create(GoldbergSphere.prototype);
        sphere.faces = [];

        const { count, dirs, sides, cornerOffset, cornerXYZ, neighborOffset, neighborIndex } = data;

        for (let p = 0; p < count; p++)
        {
            const dir = new THREE.Vector3(dirs[p * 3], dirs[p * 3 + 1], dirs[p * 3 + 2]);
            const neighbors = [];

            for (let o = neighborOffset[p]; o < neighborOffset[p + 1]; o++) neighbors.push(neighborIndex[o]);

            sphere.faces.push(new RehydratedFace(p, dir, neighbors, sides[p], cornerXYZ, cornerOffset[p], cornerOffset[p + 1]));
        }

        return sphere;
    }

    // Subdivide the icosahedron to frequency `f`; return deduplicated unit
    // points and the small triangles (triples of point indices).
    #geodesic(f)
    {
        const t = (1 + Math.sqrt(5)) / 2;

        const baseVerts = [
            [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
            [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
            [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
        ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

        const baseFaces = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
        ];

        const points = [];
        const keyToIndex = new Map();

        // Deduplicate coincident subdivided points by a COLLISION-FREE numeric
        // packed-integer key instead of a `${x},${y},${z}` string built with
        // toFixed — the string path dominated generation time at high frequency
        // (measured ~3× slower). Unit-sphere coords lie in [-1, 1]; quantising
        // each to a 16-bit bucket (step ≈ 3e-5, far finer than the smallest
        // inter-point spacing even at f=256) and packing x,y,z into one 48-bit
        // number (< 2^53, so exact) yields the same dedup with no string work.
        const Q = 32767;
        const quantKey = (x, y, z) =>
        {
            const qx = Math.round((x + 1) * Q);
            const qy = Math.round((y + 1) * Q);
            const qz = Math.round((z + 1) * Q);

            return qx * 4294967296 + qy * 65536 + qz;
        };

        const addPoint = v =>
        {
            const u = v.clone().normalize();
            const key = quantKey(u.x, u.y, u.z);
            const hit = keyToIndex.get(key);

            if (hit !== undefined) return hit;

            const idx = points.length;
            points.push(u);
            keyToIndex.set(key, idx);

            return idx;
        };

        const triangles = [];
        const tmp = new THREE.Vector3();

        for (const [ia, ib, ic] of baseFaces)
        {
            const A = baseVerts[ia];
            const B = baseVerts[ib];
            const C = baseVerts[ic];

            // Barycentric grid: P(i, j) has weights (f-i-j, i, j) / f.
            const grid = [];

            for (let i = 0; i <= f; i++)
            {
                grid[i] = [];

                for (let j = 0; j <= f - i; j++)
                {
                    const wa = f - i - j;
                    const wb = i;
                    const wc = j;

                    tmp.set(0, 0, 0)
                        .addScaledVector(A, wa)
                        .addScaledVector(B, wb)
                        .addScaledVector(C, wc);

                    grid[i][j] = addPoint(tmp);
                }
            }

            for (let i = 0; i < f; i++)
            {
                for (let j = 0; j < f - i; j++)
                {
                    triangles.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);

                    if (j < f - i - 1)
                    {
                        triangles.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
                    }
                }
            }
        }

        return { points, triangles };
    }

    // Take the dual: each point becomes a cell whose corners are the centroids
    // of its incident triangles, ordered around the point's normal.
    #buildDual(points, triangles)
    {
        const n = points.length;
        const incident = Array.from({ length: n }, () => []);
        const neighborSets = Array.from({ length: n }, () => new Set());

        for (const [a, b, c] of triangles)
        {
            const centroid = points[a].clone().add(points[b]).add(points[c]).normalize();

            incident[a].push(centroid);
            incident[b].push(centroid);
            incident[c].push(centroid);

            neighborSets[a].add(b); neighborSets[a].add(c);
            neighborSets[b].add(a); neighborSets[b].add(c);
            neighborSets[c].add(a); neighborSets[c].add(b);
        }

        for (let p = 0; p < n; p++)
        {
            const dir = points[p];
            const corners = this.#orderRing(dir, incident[p]);

            this.faces.push({
                index: p,
                dir,
                corners,
                neighbors: [...neighborSets[p]],
                sides: corners.length,
            });
        }
    }

    // Order a cell's corner points CCW around the cell normal `dir`.
    #orderRing(dir, corners)
    {
        // Tangent basis at `dir`.
        const u = corners[0].clone().addScaledVector(dir, -corners[0].dot(dir)).normalize();
        const w = dir.clone().cross(u);
        const proj = new THREE.Vector3();

        return corners
            .map(c =>
            {
                proj.copy(c).addScaledVector(dir, -c.dot(dir));

                return { c, angle: Math.atan2(proj.dot(w), proj.dot(u)) };
            })
            .sort((p, q) => p.angle - q.angle)
            .map(entry => entry.c);
    }
}

// A face rehydrated from the worker's typed-array bundle. Like GoldbergCell it
// keeps its heavy corner Vector3 ring LAZY behind a PROTOTYPE getter (not a
// per-instance defineProperty), so building the 163k faces is plain field
// assignment; the unit corners materialise from the packed cornerXYZ buffer
// only on first access (grid lines / cell ring builds) and are cached.
class RehydratedFace
{
    constructor(index, dir, neighbors, sides, cornerXYZ, start, end)
    {
        this.index = index;
        this.dir = dir;
        this.neighbors = neighbors;
        this.sides = sides;
        this._buf = cornerXYZ;
        this._start = start;
        this._end = end;
        this._corners = null;
    }

    get corners()
    {
        if (this._corners) return this._corners;

        this._corners = [];

        for (let c = this._start; c < this._end; c++)
        {
            this._corners.push(new THREE.Vector3(this._buf[c * 3], this._buf[c * 3 + 1], this._buf[c * 3 + 2]));
        }

        return this._corners;
    }
}
