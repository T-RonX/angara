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

    constructor(planet, faces, shapeField)
    {
        this.lines = this.#build(planet, faces, shapeField);
        this.lines.visible = false;
    }

    #build(planet, faces, shapeField)
    {
        const { radius, gridColor } = planet;
        const lift = (radius + 0.05) / radius; // nudge just above the surface
        const pts = [];

        // Place each corner at the (possibly displaced) surface radius in its
        // own direction so the outlines hug an irregular body; a sphere shape
        // field returns the constant `radius`, identical to before.
        const cornerR = u => (shapeField ? shapeField.surfaceRadius(u) : radius) * lift;

        for (const face of faces)
        {
            const ring = face.corners;

            for (let k = 0; k < ring.length; k++)
            {
                const a = ring[k];
                const b = ring[(k + 1) % ring.length];
                pts.push(a.clone().multiplyScalar(cornerR(a)), b.clone().multiplyScalar(cornerR(b)));
            }
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.55 });

        return new THREE.LineSegments(geo, mat);
    }
}
