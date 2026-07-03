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

        const addPoint = v =>
        {
            const u = v.clone().normalize();
            const key = `${u.x.toFixed(6)},${u.y.toFixed(6)},${u.z.toFixed(6)}`;
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
