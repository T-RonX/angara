import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergGridLines — the faint hexsphere cell outlines drawn just above the
// surface. Like the lon/lat GridLines it is hidden by default (the per-cell
// hover highlight reveals structure on demand) but handy for debugging. Each
// surface cell contributes its closed outer ring as line segments.
// ----------------------------------------------------------------------
export class GoldbergGridLines
{
    lines;

    constructor(planet, faces)
    {
        this.lines = this.#build(planet, faces);
        this.lines.visible = false;
    }

    #build(planet, faces)
    {
        const { radius, gridColor } = planet;
        const rr = (radius + 0.05) / radius; // scale unit corners just above the surface
        const pts = [];

        for (const face of faces)
        {
            const ring = face.corners;

            for (let k = 0; k < ring.length; k++)
            {
                const a = ring[k];
                const b = ring[(k + 1) % ring.length];
                pts.push(a.clone().multiplyScalar(radius * rr), b.clone().multiplyScalar(radius * rr));
            }
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.55 });

        return new THREE.LineSegments(geo, mat);
    }
}
