import * as THREE from 'three';
import { lonLatFromDir } from './GoldbergGrid.js';
import { deg2rad } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// GoldbergTraversal — how the focus point moves across the hexsphere in
// resource mode. It is fully POLE-FREE: instead of riding lon/lat (which has
// singular poles and a hard latitude clamp), the focus is a small great-circle
// FRAME on `state.focus`:
//
//   * dir   — the unit focus direction (the cell you're centred on),
//   * nCut  — the cut-plane normal (always ⟂ dir, so the focus sits ON the
//             wall); their eased targets are `dirTarget` / `nCutTarget`,
//   * wall  — the derived tangent along the cliff (nCut × dir).
//
// Motion is pure rotation of these unit vectors, so you can travel 360° in any
// direction with identical feel and NEVER notice a pole:
//
//   * left-drag / Left-Right-Up-Down : left-drag mirrors the arrow keys —
//     horizontal drag / Left-Right PANS along the wall (rotate dir about nCut;
//     nCut preserved so the plane doesn't move, no rebuild), and vertical drag /
//     Up-Down ADVANCES the cut (rotate BOTH dir and nCut about the wall tangent,
//     tilting the plane forward → rebuilds the wall).
//   * right-drag : ROLL the view about the focus radial (dir) — rotate ONLY
//     nCut about dir. dir stays put, so the camera's radial `up` and look-at are
//     fixed while the camera (offset along −nCut) orbits the focus→centre axis;
//     mouse-left rolls the view left.
//
// `FocusController` delegates its easing to advance() when this method exists,
// so the hexsphere slerps its frame while the lon/lat topology keeps its own
// lon/lat easing untouched. `focus.lon/lat` are written each frame purely so
// the generic CrustCamera + HUD read-out keep working. `resourceTraverseAxis`
// is meaningless here and ignored.
// ----------------------------------------------------------------------
export class GoldbergTraversal
{
    #index;
    #surfaceByIndex;

    #q = new THREE.Quaternion();
    #wall = new THREE.Vector3();
    #tmp = new THREE.Vector3();
    #lastNCut = new THREE.Vector3();
    #hasLast = false;

    constructor(centroidIndex, surfaceByIndex)
    {
        this.#index = centroidIndex;
        this.#surfaceByIndex = surfaceByIndex;
    }

    enterFocus(focus, cell)
    {
        this.#ensureFrame(focus);

        focus.dir.copy(cell.centroidDir).normalize();
        focus.dirTarget.copy(focus.dir);

        this.#initNCut(focus.nCut, focus.dir);
        focus.nCutTarget.copy(focus.nCut);

        this.#hasLast = false;
        this.#syncLonLat(focus);
    }

    snapTargets(focus)
    {
        this.#ensureFrame(focus);

        const cell = this.#index.nearestToDirection(focus.dirTarget);

        if (!cell) return;

        focus.dirTarget.copy(cell.centroidDir).normalize();
        this.#orthonormalize(focus.nCutTarget, focus.dirTarget);
    }

    onDrag(focus, dx, dy, dpp, button = 0)
    {
        this.#ensureFrame(focus);

        // Uniform angle from the latitude deg/pixel (no cosLat term → identical
        // sensitivity everywhere, no pole singularity).
        //
        //   * left-drag  (button 0) — same as the arrow keys: horizontal drag
        //     PANS along the wall, vertical drag ADVANCES the cut.
        //   * right-drag (button 2) — ROLL the view about the focus radial
        //     (the camera→centre axis); mouse-left spins the view left.
        if (button === 2)
        {
            const roll = deg2rad(dx * dpp.lat);

            if (roll !== 0) this.#rollTargets(focus, roll);

            return;
        }

        // Match the arrow-key sense: drag-left pans like ArrowLeft (pan +),
        // drag-up advances like ArrowUp (advance −).
        const panAngle = deg2rad(-dx * dpp.lat);
        const advAngle = deg2rad(dy * dpp.lat);

        if (panAngle !== 0) this.#panTargets(focus, panAngle);
        if (advAngle !== 0) this.#advanceTargets(focus, advAngle);
    }

    onArrow(focus, key)
    {
        this.#ensureFrame(focus);

        // One press = one cell hop; step by the local cell's angular size.
        const step = this.#stepAngle(focus.dirTarget);

        if (key === 'ArrowLeft')       this.#panTargets(focus, step);
        else if (key === 'ArrowRight') this.#panTargets(focus, -step);
        else if (key === 'ArrowUp')    this.#advanceTargets(focus, -step);
        else if (key === 'ArrowDown')  this.#advanceTargets(focus, step);
        else return;

        this.snapTargets(focus);
    }

    // Ease the frame toward its target; called every resource frame by the
    // FocusController. Returns whether anything moved and whether the CUT (nCut)
    // changed — a pure pan keeps nCut fixed, so it reports cutChanged=false and
    // the wall is not rebuilt.
    advance(focus, snapEase)
    {
        this.#ensureFrame(focus);

        const dirAng = this.#angleBetween(focus.dir, focus.dirTarget);
        const nAng = this.#angleBetween(focus.nCut, focus.nCutTarget);
        const EPS = 1e-4;

        if (dirAng <= EPS && nAng <= EPS && this.#hasLast)
        {
            return { moved: false, cutChanged: false };
        }

        if (dirAng > EPS) this.#slerpToward(focus.dir, focus.dirTarget, snapEase);
        else              focus.dir.copy(focus.dirTarget);

        if (nAng > EPS) this.#slerpToward(focus.nCut, focus.nCutTarget, snapEase);
        else            focus.nCut.copy(focus.nCutTarget);

        focus.dir.normalize();
        this.#orthonormalize(focus.nCut, focus.dir); // guard slerp drift

        const cutChanged = !this.#hasLast
            || this.#angleBetween(this.#lastNCut, focus.nCut) > EPS;

        this.#lastNCut.copy(focus.nCut);
        this.#hasLast = true;

        this.#syncLonLat(focus);

        return { moved: true, cutChanged };
    }

    // Kept for interface parity; the advance() path owns cut-change detection.
    cutMoved()
    {
        return true;
    }

    // --- internals -----------------------------------------------------

    #panTargets(focus, angle)
    {
        // Rotate the focus about the (fixed) cut normal → slides along the wall.
        this.#q.setFromAxisAngle(focus.nCutTarget, angle);
        focus.dirTarget.applyQuaternion(this.#q).normalize();
        this.#orthonormalize(focus.nCutTarget, focus.dirTarget);
    }

    #advanceTargets(focus, angle)
    {
        // Rotate BOTH focus and cut normal about the wall tangent → tilts the
        // plane forward while the focus stays on it.
        this.#wall.copy(focus.nCutTarget).cross(focus.dirTarget).normalize();
        this.#q.setFromAxisAngle(this.#wall, angle);
        focus.dirTarget.applyQuaternion(this.#q).normalize();
        focus.nCutTarget.applyQuaternion(this.#q).normalize();
        this.#orthonormalize(focus.nCutTarget, focus.dirTarget);
    }

    #rollTargets(focus, angle)
    {
        // Rotate ONLY the cut normal about the focus radial (dir) → rolls the
        // cliff/wall orientation around the centred focus cell. dir is
        // unchanged, so the camera's radial `up` and its look-at stay put while
        // the camera (offset along −nCut) orbits the focus→centre axis: a pure
        // view roll. Changing nCut rebuilds the wall on the next advance().
        this.#q.setFromAxisAngle(focus.dirTarget, angle);
        focus.nCutTarget.applyQuaternion(this.#q).normalize();
        this.#orthonormalize(focus.nCutTarget, focus.dirTarget);
    }

    #ensureFrame(focus)
    {
        if (!focus.dir)        focus.dir = new THREE.Vector3(1, 0, 0);
        if (!focus.dirTarget)  focus.dirTarget = new THREE.Vector3(1, 0, 0);
        if (!focus.nCut)       focus.nCut = new THREE.Vector3(0, 0, -1);
        if (!focus.nCutTarget) focus.nCutTarget = new THREE.Vector3(0, 0, -1);
    }

    // A cut normal ⟂ the focus radial, horizontal where possible so the wall
    // stands like a meridian; falls back cleanly when dir ≈ ±Y.
    #initNCut(out, dir)
    {
        out.set(0, 1, 0).cross(dir); // Y × dir  (points "east")

        if (out.lengthSq() < 1e-8) out.set(0, 0, -1);

        out.normalize();
        this.#orthonormalize(out, dir);
    }

    // Make `v` exactly perpendicular to the unit vector `axis`, renormalised.
    #orthonormalize(v, axis)
    {
        v.addScaledVector(axis, -v.dot(axis));

        if (v.lengthSq() < 1e-8)
        {
            v.set(0, 1, 0).cross(axis);

            if (v.lengthSq() < 1e-8) v.set(1, 0, 0).cross(axis);
        }

        v.normalize();
    }

    #angleBetween(a, b)
    {
        return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    }

    // Rotate unit vector `from` a fraction `t` of the way toward unit `to`.
    #slerpToward(from, to, t)
    {
        const ang = this.#angleBetween(from, to) * t;

        this.#tmp.copy(from).cross(to);

        if (this.#tmp.lengthSq() < 1e-12) return; // parallel / antiparallel

        this.#tmp.normalize();
        this.#q.setFromAxisAngle(this.#tmp, ang);
        from.applyQuaternion(this.#q).normalize();
    }

    // Angular size of one cell at `dir` (smallest neighbour hop), used as the
    // arrow-key step so one press lands on the next cell.
    #stepAngle(dir)
    {
        const cell = this.#index.nearestToDirection(dir);

        if (!cell || !cell.neighbors) return deg2rad(5);

        let best = Infinity;

        for (const idx of cell.neighbors)
        {
            const nb = this.#surfaceByIndex.get(idx);

            if (!nb) continue;

            const ang = this.#angleBetween(cell.centroidDir, nb.centroidDir);

            if (ang < best) best = ang;
        }

        return Number.isFinite(best) ? best : deg2rad(5);
    }

    #syncLonLat(focus)
    {
        const cur = lonLatFromDir(focus.dir);
        focus.lon = cur.lon;
        focus.lat = cur.lat;

        const tgt = lonLatFromDir(focus.dirTarget);
        focus.lonTarget = tgt.lon;
        focus.latTarget = tgt.lat;
    }
}
