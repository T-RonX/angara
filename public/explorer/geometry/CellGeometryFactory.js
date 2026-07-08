import * as THREE from 'three';
import { sphere } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// CellGeometryFactory — turns a cell record into raw vertex / normal /
// index data. A cell is either:
//   * a general N-gon PRISM (quad = 4, pentagon = 5, hexagon = 6, …),
//     described by an ordered `outerRing` of N corners and a matching
//     `innerRing` at the deeper radius, or
//   * a lon/lat polar `cap` dome (a smooth fan — only the lon/lat topology
//     produces these).
//
// The same code feeds either a standalone single-cell geometry (hover
// overlay) or a merged depth-layer mesh. Prism outer/inner faces carry
// radial normals (smooth across cells); side faces carry a flat normal.
// Winding is derived per face from the cell centroid so any ring
// orientation renders correctly under FrontSide culling.
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
            this.#appendPrismCell(cell, positions, normals, indices);
        }

        cell.triCount = indices.length / 3 - triStart;
    }

    // Cell geometry is STATIC (it depends only on the cell's corner rings, which
    // never change), so compute each cell's raw arrays ONCE and cache them on the
    // cell. The merged-slice rebuild path (#buildBucketMesh / fade / atmosphere)
    // re-runs every ~55ms while the cut advances; recomputing appendCell there
    // meant per-corner Vector3 clone/normalize/cross math for thousands of cells
    // every step. With the cache those rebuilds become plain number copies.
    cellArrays(cell)
    {
        if (cell.geoCache) return cell.geoCache;

        const positions = [], normals = [], indices = [];
        this.appendCell(cell, positions, normals, indices);

        cell.geoCache = {
            pos: new Float32Array(positions),
            nrm: new Float32Array(normals),
            idx: new Uint32Array(indices),
            triCount: cell.triCount,
        };

        return cell.geoCache;
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

    #appendPrismCell(cell, positions, normals, indices)
    {
        const outer = cell.outerRing;
        const inner = cell.innerRing;
        const n = outer.length;

        // Use the stable directional centroid (from face topology) scaled to the
        // average radius of the cell's corners. For displaced bodies, this avoids
        // averaging across corners with different displacement levels (outer heavily
        // displaced vs inner at layer depth), which can produce incorrect winding
        // direction and cause back-face culling to remove front faces.
        let sumRadius = 0;
        for (const p of outer) sumRadius += Math.hypot(p.x, p.y, p.z);
        for (const p of inner) sumRadius += Math.hypot(p.x, p.y, p.z);
        const avgRadius = sumRadius / (2 * n);

        const dir = cell.centroidDir;
        const cen = new THREE.Vector3(dir.x * avgRadius, dir.y * avgRadius, dir.z * avgRadius);

        // Outer skin (radial-outward normals) and inner skin (inward).
        this.#appendFan(outer, +1, positions, normals, indices);
        this.#appendFan(inner, -1, positions, normals, indices);

        // One flat side quad per ring edge.
        for (let k = 0; k < n; k++)
        {
            const k2 = (k + 1) % n;
            this.#appendSideQuad(outer[k], outer[k2], inner[k2], inner[k], cen, positions, normals, indices);
        }
    }

    // Fan-triangulate a ring with radial normals. `dir` = +1 pushes the
    // normals outward (outer skin), -1 inward (inner skin). The winding is
    // flipped when needed so the visible face survives FrontSide culling.
    #appendFan(ring, dir, positions, normals, indices)
    {
        const n = ring.length;

        const cen = new THREE.Vector3();
        for (const p of ring) cen.add(p);
        cen.multiplyScalar(1 / n);
        const desired = cen.clone().normalize().multiplyScalar(dir);

        const gn = ring[1].clone().sub(ring[0]).cross(ring[2].clone().sub(ring[0]));
        const reverse = gn.dot(desired) < 0;

        const base = positions.length / 3;

        for (const p of ring)
        {
            positions.push(p.x, p.y, p.z);
            const inv = dir / (Math.hypot(p.x, p.y, p.z) || 1);
            normals.push(p.x * inv, p.y * inv, p.z * inv);
        }

        for (let i = 1; i < n - 1; i++)
        {
            if (reverse) indices.push(base, base + i + 1, base + i);
            else         indices.push(base, base + i, base + i + 1);
        }
    }

    // A flat side quad [a,b outer][c,d inner], normal oriented away from the
    // cell centroid so it faces outward.
    #appendSideQuad(a, b, c, d, cen, positions, normals, indices)
    {
        let nx = (b.y - a.y) * (d.z - a.z) - (b.z - a.z) * (d.y - a.y);
        let ny = (b.z - a.z) * (d.x - a.x) - (b.x - a.x) * (d.z - a.z);
        let nz = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        const mx = (a.x + b.x + c.x + d.x) / 4 - cen.x;
        const my = (a.y + b.y + c.y + d.y) / 4 - cen.y;
        const mz = (a.z + b.z + c.z + d.z) / 4 - cen.z;
        const flip = (nx * mx + ny * my + nz * mz) < 0;

        if (flip) { nx = -nx; ny = -ny; nz = -nz; }

        const winding = flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
        const base = positions.length / 3;

        for (const p of winding)
        {
            positions.push(p.x, p.y, p.z);
            normals.push(nx, ny, nz);
        }

        indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
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

