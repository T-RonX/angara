import * as THREE from 'three';
import { sphere } from '../core/MathUtils.js';
import { CELL_EDGES } from './CellGeometryFactory.js';

// ----------------------------------------------------------------------
// CrossSectionFactory — intersects a cell (quad or polar cap) with the
// current clip plane, producing the flat polygon that "closes" the cell on
// the slice. Returns everything as { positions, indices } so callers can
// treat both cell kinds uniformly. Also offers Sutherland–Hodgman clipping
// of a polygon to the visible (camera-side) half-space.
// ----------------------------------------------------------------------
export class CrossSectionFactory
{
    #clipPlane;
    #focus;
    #planetRadius;
    #rings;

    constructor(clipPlane, focus, planetRadius, polarCapRings)
    {
        this.#clipPlane = clipPlane;
        this.#focus = focus;
        this.#planetRadius = planetRadius;
        this.#rings = Math.max(2, polarCapRings ?? 4);
    }

    // Uniform { positions, indices } cross-section for either cell kind.
    cellCrossSection(cell)
    {
        if (cell.kind === 'cap')
        {
            return this.capCellCrossSection(cell);
        }

        const pts = this.quadCellCrossSection(cell.corners);

        if (pts === null) return null;

        const indices = [];

        // Convex polygon — fan-triangulate from pts[0].
        for (let t = 1; t < pts.length - 1; t++)
        {
            indices.push(0, t, t + 1);
        }

        return { positions: pts, indices };
    }

    // Intersect a quad cell hexahedron with the clip plane → ordered polygon.
    quadCellCrossSection(corners)
    {
        const n = this.#clipPlane.normal, k = this.#clipPlane.constant;
        const dist = corners.map(v => n.dot(v) + k);
        const pts = [];

        for (const [a, b] of CELL_EDGES)
        {
            const da = dist[a], db = dist[b];

            if ((da < 0) !== (db < 0))
            {
                const t = da / (da - db);
                pts.push(corners[a].clone().lerp(corners[b], t));
            }
        }

        if (pts.length < 3)
        {
            return null;
        }

        // Order the points around their centroid in the plane.
        const c = new THREE.Vector3();
        for (const p of pts) c.add(p);
        c.multiplyScalar(1 / pts.length);

        const u = new THREE.Vector3(1, 0, 0).cross(n);

        if (u.lengthSq() < 1e-6)
        {
            u.set(0, 0, 1).cross(n);
        }

        u.normalize();
        const v = n.clone().cross(u).normalize();
        pts.sort((p, q) => {
            const pa = Math.atan2(v.dot(p.clone().sub(c)), u.dot(p.clone().sub(c)));
            const qa = Math.atan2(v.dot(q.clone().sub(c)), u.dot(q.clone().sub(c)));

            return pa - qa;
        });

        return pts;
    }

    // Cross-section of a polar cap with the meridian clip plane. The cap is
    // a smooth dome (polarCapRings subdivisions), so the plane cuts it along
    // a CURVED arc; sampling that arc keeps the cross-section matching the
    // rendered geometry. Returned as a triangulated quad strip between the
    // outer and inner arcs.
    capCellCrossSection(cell)
    {
        const { sign, boundaryLat, rOuter, rInner } = cell;
        const lonA = this.#focus.lon;
        const lonB = this.#focus.lon + 180;
        const poleLat = sign * 90;
        const rings = this.#rings;

        const outerArc = [];
        const innerArc = [];

        // lonA side: boundary lat → pole.
        for (let i = 0; i <= rings; i++)
        {
            const t = i / rings;
            const lat = boundaryLat + (poleLat - boundaryLat) * t;

            if (i === rings)
            {
                // Exact pole point (avoids cos(±90) jitter).
                outerArc.push(new THREE.Vector3(0, sign * rOuter, 0));
                innerArc.push(new THREE.Vector3(0, sign * rInner, 0));
            }
            else
            {
                outerArc.push(sphere(lonA, lat, rOuter));
                innerArc.push(sphere(lonA, lat, rInner));
            }
        }

        // lonB side: pole → boundary lat (skip i=0, the pole apex).
        for (let i = 1; i <= rings; i++)
        {
            const t = i / rings;
            const lat = poleLat + (boundaryLat - poleLat) * t;
            outerArc.push(sphere(lonB, lat, rOuter));
            innerArc.push(sphere(lonB, lat, rInner));
        }

        const N = outerArc.length;
        const positions = outerArc.concat(innerArc);
        const indices = [];

        for (let i = 0; i < N - 1; i++)
        {
            const o0 = i;
            const o1 = i + 1;
            const i0 = N + i;
            const i1 = N + i + 1;
            indices.push(o0, o1, i1);
            indices.push(o0, i1, i0);
        }

        return { positions, indices };
    }

    // Clip an ordered polygon against the clip plane, keeping the
    // camera-side half-space (dot(n,p) + k >= 0). A small epsilon keeps
    // vertices that sit exactly on the seam.
    clipPolygonToVisibleHalf(points)
    {
        const n = this.#clipPlane.normal, k = this.#clipPlane.constant;
        const eps = this.#planetRadius * 1e-5;
        const out = [];
        const count = points.length;

        for (let i = 0; i < count; i++)
        {
            const cur = points[i];
            const nxt = points[(i + 1) % count];
            const dCur = n.dot(cur) + k;
            const dNxt = n.dot(nxt) + k;
            const curIn = dCur >= -eps;
            const nxtIn = dNxt >= -eps;

            if (curIn)
            {
                out.push(cur);
            }

            if (curIn !== nxtIn)
            {
                const t = dCur / (dCur - dNxt);
                out.push(cur.clone().lerp(nxt, t));
            }
        }

        return out;
    }
}

