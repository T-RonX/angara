import * as THREE from 'three';
import { sphere } from '../core/MathUtils.js';

// Triangulation of the 6 faces of a quad (hexahedron) cell, indexed into
// the 8 corners [A,B,C,D outer, E,F,G,H inner]. Wound so normals face
// OUTWARD (FrontSide culling keeps the visible faces).
export const FACE_TRIS = [
    [0, 2, 1, 0, 3, 2], // 0: outer
    [4, 5, 6, 4, 6, 7], // 1: inner
    [0, 5, 4, 0, 1, 5], // 2: lat0 side
    [1, 6, 5, 1, 2, 6], // 3: lon1 side
    [2, 7, 6, 2, 3, 7], // 4: lat1 side
    [3, 4, 7, 3, 0, 4], // 5: lon0 side
];

// The 12 edges of a quad cell hexahedron (corner index pairs).
export const CELL_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0], // outer ring
    [4, 5], [5, 6], [6, 7], [7, 4], // inner ring
    [0, 4], [1, 5], [2, 6], [3, 7], // verticals
];

// ----------------------------------------------------------------------
// CellGeometryFactory — turns a cell record (quad or polar cap) into raw
// vertex / normal / index data. The same code feeds either a standalone
// single-cell geometry (for the hover overlay) or a merged depth-layer
// mesh. Vertices are duplicated per face so each face carries its own
// normals: radial for outer/inner faces (smooth across cells), flat for
// the side faces.
// ----------------------------------------------------------------------
export class CellGeometryFactory
{
    #rings;

    constructor(polarCapRings)
    {
        this.#rings = Math.max(2, polarCapRings ?? 4);
    }

    // Append one cell's geometry, recording its triangle count on the cell.
    appendCell(cell, positions, normals, indices)
    {
        const triStart = indices.length / 3;

        if (cell.kind === 'cap')
        {
            this.#appendCapCell(cell, positions, normals, indices);
        }
        else
        {
            this.#appendQuadCell(cell, positions, normals, indices);
        }

        cell.triCount = indices.length / 3 - triStart;
    }

    // Standalone BufferGeometry for ONE cell (hover / selection overlay).
    buildSingleCellGeometry(cell)
    {
        const positions = [], normals = [], indices = [];
        this.appendCell(cell, positions, normals, indices);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        return geo;
    }

    #appendQuadCell(cell, positions, normals, indices)
    {
        const corners = cell.corners;
        const vertBase = positions.length / 3;

        for (let f = 0; f < 6; f++)
        {
            const tris = FACE_TRIS[f];

            // Flat face normal for side / inner faces.
            const a = corners[tris[0]], b = corners[tris[1]], c = corners[tris[2]];
            const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
            const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            for (let t = 0; t < 6; t++)
            {
                const p = corners[tris[t]];
                positions.push(p.x, p.y, p.z);

                if (f === 0)
                {
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    normals.push(p.x / len, p.y / len, p.z / len);
                }
                else if (f === 1)
                {
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    normals.push(-p.x / len, -p.y / len, -p.z / len);
                }
                else
                {
                    normals.push(nx, ny, nz);
                }

                indices.push(vertBase + f * 6 + t);
            }
        }
    }

    #appendCapCell(cell, positions, normals, indices)
    {
        const { boundaryLat, rOuter, rInner, sign, fan } = cell;
        const rings = this.#rings;
        const poleLat = sign * 90;

        // Pre-sample concentric rings between the pole and the cap boundary
        // at both crust radii — sampling on the real sphere rounds the
        // silhouette (a single pole→ring fan would draw a cone).
        const outerRings = [];
        const innerRings = [];

        for (let i = 0; i <= rings; i++)
        {
            const t = i / rings;
            const lat = poleLat + (boundaryLat - poleLat) * t;
            const ringO = new Array(fan);
            const ringI = new Array(fan);

            for (let k = 0; k < fan; k++)
            {
                const lon = (k / fan) * 360;
                ringO[k] = sphere(lon, lat, rOuter);
                ringI[k] = sphere(lon, lat, rInner);
            }

            outerRings.push(ringO);
            innerRings.push(ringI);
        }

        // Outer skin: quad strips between rings, radial-outward normals.
        for (let i = 0; i < rings; i++)
        {
            const r0 = outerRings[i];
            const r1 = outerRings[i + 1];

            for (let k = 0; k < fan; k++)
            {
                const k2 = (k + 1) % fan;
                const a = r0[k], b = r0[k2], c = r1[k2], d = r1[k];
                const verts = sign > 0 ? [a, b, c, a, c, d] : [a, d, c, a, c, b];
                const base = positions.length / 3;

                for (const p of verts) this.#pushRadial(positions, normals, p, 1);

                indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
            }
        }

        // Inner skin: same strips, inward normals, reversed winding.
        for (let i = 0; i < rings; i++)
        {
            const r0 = innerRings[i];
            const r1 = innerRings[i + 1];

            for (let k = 0; k < fan; k++)
            {
                const k2 = (k + 1) % fan;
                const a = r0[k], b = r0[k2], c = r1[k2], d = r1[k];
                const verts = sign > 0 ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
                const base = positions.length / 3;

                for (const p of verts) this.#pushRadial(positions, normals, p, -1);

                indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
            }
        }

        // Boundary cone wall: quad strip between outer / inner boundary rings.
        const ringOuter = outerRings[rings];
        const ringInner = innerRings[rings];

        for (let k = 0; k < fan; k++)
        {
            const k2 = (k + 1) % fan;
            const a = ringOuter[k];
            const b = ringOuter[k2];
            const c = ringInner[k2];
            const d = ringInner[k];

            const mx = (a.x + b.x + c.x + d.x) / 4;
            const mz = (a.z + b.z + c.z + d.z) / 4;
            const ml = Math.hypot(mx, mz) || 1;
            const outX = mx / ml, outZ = mz / ml;

            let e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
            let e2x = d.x - a.x, e2y = d.y - a.y, e2z = d.z - a.z;
            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            const flip = (nx * outX + nz * outZ) < 0;

            if (flip) { nx = -nx; ny = -ny; nz = -nz; }

            const winding = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
            const base = positions.length / 3;

            for (const p of winding)
            {
                positions.push(p.x, p.y, p.z);
                normals.push(nx, ny, nz);
            }

            indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
        }
    }

    // Push a vertex with a radial normal scaled by `dir` (+1 out, -1 in).
    #pushRadial(positions, normals, p, dir)
    {
        positions.push(p.x, p.y, p.z);
        const len = Math.hypot(p.x, p.y, p.z) || 1;
        normals.push(dir * p.x / len, dir * p.y / len, dir * p.z / len);
    }
}

