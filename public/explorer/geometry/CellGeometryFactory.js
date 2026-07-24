import * as THREE from 'three';

export const CELL_GEOMETRY_VARIANT = Object.freeze({
    FULL: 'full',
    NO_OUTER: 'noOuter',
});

// ----------------------------------------------------------------------
// CellGeometryFactory — turns a cell record into raw vertex / normal /
// index data. A cell is a general N-gon PRISM (quad = 4, pentagon = 5,
// hexagon = 6, …), described by an ordered `outerRing` of N corners and a
// matching `innerRing` at the deeper radius.
//
// The same code feeds either a standalone single-cell geometry (hover
// overlay) or a merged depth-layer mesh. Prism outer/inner faces carry
// radial normals (smooth across cells); side faces carry a flat normal.
// Winding is derived per face from the cell centroid so any ring
// orientation renders correctly under FrontSide culling.
// ----------------------------------------------------------------------
export class CellGeometryFactory
{
    constructor()
    {
    }

    // Append one cell's geometry, recording its triangle count on the cell.
    appendCell(cell, positions, normals, indices, tileIds = null, outwardFaces = null)
    {
        const triStart = indices.length / 3;

        this.#appendPrismCell(cell, positions, normals, indices, true, tileIds, outwardFaces);

        cell.triCount = indices.length / 3 - triStart;
    }

    // Append only the immutable outward-facing fan. The persistent slice atlas
    // uses this path so constructing it does not populate every cell's prism cache.
    appendOuterFace(cell, positions, normals, indices, tileIds = null, outwardFaces = null)
    {
        this.#appendFan(
            cell.outerRing,
            +1,
            positions,
            normals,
            indices,
            tileIds,
            outwardFaces,
            cell.cellIndex,
            !cell.isAtmosphere,
        );
    }

    // Cell geometry is STATIC (it depends only on the cell's corner rings, which
    // never change), so compute each cell's raw arrays ONCE and cache them on the
    // cell. The merged-slice rebuild paths (persistent streams, fades, atmosphere)
    // re-runs every ~55ms while the cut advances; recomputing appendCell there
    // meant per-corner Vector3 clone/normalize/cross math for thousands of cells
    // every step. With the cache those rebuilds become plain number copies.
    cellArrays(cell, variant = CELL_GEOMETRY_VARIANT.FULL)
    {
        if (variant === CELL_GEOMETRY_VARIANT.NO_OUTER)
        {
            return this.#cellArraysWithoutOuter(cell);
        }

        if (variant !== CELL_GEOMETRY_VARIANT.FULL)
        {
            throw new Error(`[CellGeometryFactory] Unknown geometry variant: ${variant}`);
        }

        if (cell.geoCache) return cell.geoCache;

        const positions = [], normals = [], indices = [], tileIds = [], outwardFaces = [];
        this.appendCell(cell, positions, normals, indices, tileIds, outwardFaces);

        // #appendPrismCell always emits, in order: the outer (surface-facing)
        // fan (n-2 triangles), then the inner (core-facing / "bottom") fan
        // (n-2 triangles), then the side quads. Record the inner fan's
        // triangle range so mesh builders can mark it non-pickable.
        const n = cell.outerRing.length;
        const innerFaceTriStart = n - 2;
        const innerFaceTriCount = n - 2;

        cell.geoCache = {
            pos: new Float32Array(positions),
            nrm: new Float32Array(normals),
            idx: new Uint32Array(indices),
            tileId: new Float32Array(tileIds),
            outwardFace: new Float32Array(outwardFaces),
            triCount: cell.triCount,
            innerFaceTriStart,
            innerFaceTriCount,
        };

        return cell.geoCache;
    }

    // Wall prisms share their outer face with the immutable surface atlas.
    // This static variant emits only the inner fan and side quads.
    #cellArraysWithoutOuter(cell)
    {
        if (cell.wallGeoCache) return cell.wallGeoCache;

        const positions = [], normals = [], indices = [], tileIds = [], outwardFaces = [];
        const triStart = indices.length / 3;

        this.#appendPrismCell(
            cell,
            positions,
            normals,
            indices,
            false,
            tileIds,
            outwardFaces,
        );

        const n = cell.outerRing.length;

        cell.wallGeoCache = {
            pos: new Float32Array(positions),
            nrm: new Float32Array(normals),
            idx: new Uint32Array(indices),
            tileId: new Float32Array(tileIds),
            outwardFace: new Float32Array(outwardFaces),
            triCount: indices.length / 3 - triStart,
            innerFaceTriStart: 0,
            innerFaceTriCount: n - 2,
        };

        return cell.wallGeoCache;
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

    #appendPrismCell(
        cell,
        positions,
        normals,
        indices,
        includeOuter = true,
        tileIds = null,
        outwardFaces = null,
    )
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
        if (includeOuter)
        {
            this.#appendFan(
                outer,
                +1,
                positions,
                normals,
                indices,
                tileIds,
                outwardFaces,
                cell.cellIndex,
                cell.depth === 0 && !cell.isAtmosphere,
            );
        }
        this.#appendFan(
            inner,
            -1,
            positions,
            normals,
            indices,
            tileIds,
            outwardFaces,
            cell.cellIndex,
            false,
        );

        // One flat side quad per ring edge.
        for (let k = 0; k < n; k++)
        {
            const k2 = (k + 1) % n;
            this.#appendSideQuad(
                outer[k],
                outer[k2],
                inner[k2],
                inner[k],
                cen,
                positions,
                normals,
                indices,
                tileIds,
                outwardFaces,
                cell.cellIndex,
            );
        }
    }

    // Fan-triangulate a ring with radial normals. `dir` = +1 pushes the
    // normals outward (outer skin), -1 inward (inner skin). The winding is
    // flipped when needed so the visible face survives FrontSide culling.
    #appendFan(
        ring,
        dir,
        positions,
        normals,
        indices,
        tileIds = null,
        outwardFaces = null,
        tileId = 0,
        isOutward = false,
    )
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
            tileIds?.push(tileId);
            outwardFaces?.push(isOutward ? 1 : 0);
        }

        for (let i = 1; i < n - 1; i++)
        {
            if (reverse) indices.push(base, base + i + 1, base + i);
            else         indices.push(base, base + i, base + i + 1);
        }
    }

    // A flat side quad [a,b outer][c,d inner], normal oriented away from the
    // cell centroid so it faces outward.
    #appendSideQuad(
        a,
        b,
        c,
        d,
        cen,
        positions,
        normals,
        indices,
        tileIds = null,
        outwardFaces = null,
        tileId = 0,
    )
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
            tileIds?.push(tileId);
            outwardFaces?.push(0);
        }

        indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
    }
}
