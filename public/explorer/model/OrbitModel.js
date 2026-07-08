import * as THREE from 'three';

// ----------------------------------------------------------------------
// OrbitModel — the pure, serialisable orbital motion of ONE body around its
// parent. Given a time it returns the body's position RELATIVE TO ITS PARENT
// (a local offset vector). It knows nothing about the scene, other bodies, or
// rendering; the OrbitSystem composes these local offsets into world positions.
//
// The orbit is a Keplerian-lite ellipse: a circle of radius `semiMajorAxis`
// (scaled to an ellipse by `eccentricity`), tilted by `inclination` and
// rotated by `ascendingNode`, swept at a constant angular rate (period). This
// is deterministic — same params + same time ⇒ same position — so the backend
// can drive it later without any client state.
//
// SINGLE RESPONSIBILITY: "where is this body relative to its parent at time t".
// ----------------------------------------------------------------------
export class OrbitModel
{
    #a;             // semi-major axis
    #b;             // semi-minor axis (from eccentricity)
    #omega;         // angular rate (rad/sec)
    #phase;         // phase offset (rad)
    #tilt;          // orientation quaternion (inclination + ascending node)
    #static;        // fixed offset for non-orbiting bodies (e.g. the primary)
    #orbit;         // the live (mutable) orbit config the sliders edit
    #local = new THREE.Vector3();

    constructor(orbit)
    {
        this.#orbit = orbit ?? null;
        this.configure(orbit);
    }

    // (Re)derive the cached ellipse from the orbit config. Called from the
    // constructor and again whenever the HUD orbit sliders mutate the config,
    // so the motion updates live without rebuilding the model.
    configure(orbit)
    {
        this.#orbit = orbit ?? null;

        if (!orbit)
        {
            // No orbit → the body sits at its parent's origin (the primary).
            this.#static = new THREE.Vector3(0, 0, 0);

            return;
        }

        this.#static = null;

        const a = orbit.semiMajorAxis ?? 0;
        const e = THREE.MathUtils.clamp(orbit.eccentricity ?? 0, 0, 0.9);

        this.#a = a;
        this.#b = a * Math.sqrt(1 - e * e);

        const period = orbit.periodSec ?? 0;
        this.#omega = period > 0 ? (2 * Math.PI) / period : 0;
        this.#phase = THREE.MathUtils.degToRad(orbit.phaseDeg ?? 0);

        const incl = THREE.MathUtils.degToRad(orbit.inclinationDeg ?? 0);
        const node = THREE.MathUtils.degToRad(orbit.ascendingNodeDeg ?? 0);

        // Orbit plane starts in XZ (ecliptic), tilted by inclination about the
        // node-rotated X axis; ascendingNode spins the whole plane about Y.
        this.#tilt = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(incl, node, 0, 'YXZ'));
    }

    get orbit() { return this.#orbit; }

    // Local offset from the parent at absolute time `tSec`.
    positionAt(tSec)
    {
        if (this.#static)
        {
            return this.#local.copy(this.#static);
        }

        const theta = this.#phase + this.#omega * tSec;

        this.#local.set(
            this.#a * Math.cos(theta),
            0,
            this.#b * Math.sin(theta),
        );

        return this.#local.applyQuaternion(this.#tilt);
    }
}
