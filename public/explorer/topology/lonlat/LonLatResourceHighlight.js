import * as THREE from 'three';
import { sphere } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// LonLatResourceHighlight — builds the resource-mode hover / selection
// overlay geometry for the longitude/latitude topology. A cell carved open
// by the cut shows only a sliver, so the highlight is a slim mesh of:
//   * the cross-section face on the clip plane (always), plus
//   * on the surface layer, the outer face wrapping over the cliff top
//     (a curved cap dome for polar caps, or the clipped outer ring for a
//     quad).
//
// This is the ORIGINAL behaviour, extracted out of HighlightManager so the
// "what shape is a highlighted resource cell" policy lives with the topology.
// ----------------------------------------------------------------------
export class LonLatResourceHighlight
{
    #crossSection;
    #geometryFactory;
    #clip;
    #rings;

    constructor(crossSection, geometryFactory, clip, polarCapRings)
    {
        this.#crossSection = crossSection;
        this.#geometryFactory = geometryFactory;
        this.#clip = clip;
        this.#rings = Math.max(2, polarCapRings ?? 4);
    }

    build(cell)
    {
        // Atmosphere cells are see-through → wireframe box of the whole cell.
        if (cell.isAtmosphere)
        {
            return this.#geometryFactory.buildSingleCellGeometry(cell);
        }

        const positions = [];
        const normals = [];
        const indices = [];
        const n = this.#clip.plane.normal;

        // (a) Cross-section face on the clip plane.
        const cross = this.#crossSection.cellCrossSection(cell);

        if (cross !== null)
        {
            const base = positions.length / 3;

            for (const p of cross.positions)
            {
                positions.push(p.x, p.y, p.z);
                normals.push(-n.x, -n.y, -n.z);
            }

            for (const i of cross.indices)
            {
                indices.push(base + i);
            }
        }

        // (b) On the surface layer, also include the outer face so the
        // highlight wraps over the top edge of the cliff.
        if (cell.depth === 0 && cell.kind !== 'cap')
        {
            const clipped = this.#crossSection.clipPolygonToVisibleHalf(cell.outerRing);

            if (clipped.length >= 3)
            {
                const base = positions.length / 3;

                for (const p of clipped)
                {
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    positions.push(p.x, p.y, p.z);
                    normals.push(p.x / len, p.y / len, p.z / len);
                }

                for (let t = 1; t < clipped.length - 1; t++)
                {
                    indices.push(base, base + t, base + t + 1);
                }
            }
        }
        else if (cell.depth === 0 && cell.kind === 'cap')
        {
            this.#appendCapOuterSkin(cell, positions, normals, indices);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        return geo;
    }

    // Outer skin of a polar cap, clipped to the visible half-dome — so
    // hovering a polar cap lights up the whole pole, not just a sliver.
    #appendCapOuterSkin(cell, positions, normals, indices)
    {
        const { boundaryLat, rOuter, sign, fan } = cell;
        const rings = this.#rings;
        const poleLat = sign * 90;
        const outerRings = [];

        for (let i = 0; i <= rings; i++)
        {
            const t = i / rings;
            const lat = poleLat + (boundaryLat - poleLat) * t;
            const ring = new Array(fan);

            for (let j = 0; j < fan; j++)
            {
                ring[j] = sphere((j / fan) * 360, lat, rOuter);
            }

            outerRings.push(ring);
        }

        for (let i = 0; i < rings; i++)
        {
            const r0 = outerRings[i];
            const r1 = outerRings[i + 1];

            for (let j = 0; j < fan; j++)
            {
                const j2 = (j + 1) % fan;
                const a = r0[j], b = r0[j2], c = r1[j2], d = r1[j];
                const ring = sign > 0 ? [a, b, c, d] : [a, d, c, b];
                const clipped = this.#crossSection.clipPolygonToVisibleHalf(ring);

                if (clipped.length < 3) continue;

                const base = positions.length / 3;

                for (const p of clipped)
                {
                    positions.push(p.x, p.y, p.z);
                    const len = Math.hypot(p.x, p.y, p.z) || 1;
                    normals.push(p.x / len, p.y / len, p.z / len);
                }

                for (let tri = 1; tri < clipped.length - 1; tri++)
                {
                    indices.push(base, base + tri, base + tri + 1);
                }
            }
        }
    }
}
