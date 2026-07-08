import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergGridLines — the faint hexsphere cell outlines drawn just above the
// surface. Like the lon/lat GridLines it is hidden by default (the per-cell
// hover highlight reveals structure on demand) but handy for debugging. Each
// surface cell contributes its closed outer ring as line segments.
//
// The outline geometry is ~2M vertices at high hexFrequency and, being hidden
// by default, was a pure load-time cost for nothing. It is therefore built
// LAZILY: the LineSegments starts with empty geometry and materialises the
// outlines the first time it is actually rendered while visible (via
// onBeforeRender). Turning it on later pays the one-off build; never turning it
// on costs nothing. The feature is unchanged.
// ----------------------------------------------------------------------
export class GoldbergGridLines
{
    lines;

    #built = false;

    constructor(planet, faces, shapeField)
    {
        const mat = new THREE.LineBasicMaterial({ color: planet.gridColor, transparent: true, opacity: 0.55 });

        this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
        this.lines.visible = false;

        this.lines.onBeforeRender = () =>
        {
            if (this.#built) return;

            this.#built = true;
            this.lines.geometry.dispose();
            this.lines.geometry = this.#buildGeometry(planet, faces, shapeField);
        };
    }

    #buildGeometry(planet, faces, shapeField)
    {
        const { radius } = planet;
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

        return new THREE.BufferGeometry().setFromPoints(pts);
    }
}
