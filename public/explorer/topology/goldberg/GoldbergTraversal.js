import * as THREE from 'three';

// ----------------------------------------------------------------------
// GoldbergTraversal — how the focus point moves across the hexsphere in
// resource mode. Because the cells are irregular hexagons/pentagons there is
// no lon/lat row/column to step; instead:
//
//   * drag  — strolls the focus freely across the surface (continuous
//             lon/lat) and snaps to the nearest cell centre on release,
//   * arrow — steps to the edge-adjacent NEIGHBOUR that lies most in the
//             pressed compass direction (up = toward +Y, right = east),
//   * snap  — nearest cell centre via the centroid index.
//
// The focus stays expressed as { lon, lat } so the crust camera and easing
// stay generic; this class maps that continuous coordinate onto discrete
// Goldberg cells. `resourceTraverseAxis` is meaningless here and ignored.
// ----------------------------------------------------------------------
export class GoldbergTraversal
{
    #index;
    #surfaceByIndex;

    #up = new THREE.Vector3();
    #north = new THREE.Vector3();
    #east = new THREE.Vector3();
    #desired = new THREE.Vector3();
    #offset = new THREE.Vector3();

    constructor(centroidIndex, surfaceByIndex)
    {
        this.#index = centroidIndex;
        this.#surfaceByIndex = surfaceByIndex;
    }

    enterFocus(focus, cell)
    {
        focus.lonTarget = cell.lon;
        focus.latTarget = cell.lat;
        focus.lon = cell.lon;
        focus.lat = cell.lat;
    }

    snapTargets(focus)
    {
        const cell = this.#index.nearestToLonLat(focus.lonTarget, focus.latTarget);

        if (!cell) return;

        focus.lonTarget = cell.lon;
        focus.latTarget = cell.lat;
    }

    onDrag(focus, dx, dy, dpp)
    {
        // Free stroll: vertical drag travels along latitude, horizontal along
        // longitude. Snapping to a cell happens on release (snapTargets).
        focus.latTarget = Math.max(-89.9, Math.min(89.9, focus.latTarget - dy * dpp.lat));
        focus.lonTarget = (focus.lonTarget + dx * dpp.lon + 360) % 360;
    }

    onArrow(focus, key)
    {
        const current = this.#index.nearestToLonLat(focus.lonTarget, focus.latTarget);

        if (!current) return;

        this.#tangentBasis(current.centroidDir);

        this.#desired.set(0, 0, 0);
        if (key === 'ArrowUp')    this.#desired.copy(this.#north);
        if (key === 'ArrowDown')  this.#desired.copy(this.#north).multiplyScalar(-1);
        if (key === 'ArrowRight') this.#desired.copy(this.#east);
        if (key === 'ArrowLeft')  this.#desired.copy(this.#east).multiplyScalar(-1);

        if (this.#desired.lengthSq() === 0) return;

        let best = null;
        let bestScore = 0; // require a positive projection to move

        for (const idx of current.neighbors)
        {
            const nb = this.#surfaceByIndex.get(idx);

            if (!nb) continue;

            // Tangential offset of the neighbour relative to the current cell.
            this.#offset.copy(nb.centroidDir)
                .addScaledVector(this.#up, -nb.centroidDir.dot(this.#up));

            const score = this.#offset.dot(this.#desired);

            if (score > bestScore)
            {
                bestScore = score;
                best = nb;
            }
        }

        if (!best) return;

        focus.lonTarget = best.lon;
        focus.latTarget = best.lat;
    }

    // The meridian cut only moves when longitude changes; latitude just slides
    // the focus along the same great-circle wall (the camera pans).
    cutMoved(lonChanged)
    {
        return lonChanged;
    }

    // Build a surface tangent basis (north / east) at a cell centre direction.
    #tangentBasis(dir)
    {
        this.#up.copy(dir);

        // North = the +Y direction projected onto the tangent plane. Falls
        // back to +Z near the (non-existent) poles for numerical safety.
        this.#north.set(0, 1, 0).addScaledVector(this.#up, -this.#up.y);

        if (this.#north.lengthSq() < 1e-8)
        {
            this.#north.set(0, 0, 1).addScaledVector(this.#up, -this.#up.z);
        }

        this.#north.normalize();

        // East = up × north (direction of increasing longitude).
        this.#east.copy(this.#up).cross(this.#north).normalize();
    }
}
