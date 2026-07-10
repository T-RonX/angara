import * as THREE from 'three';

// ----------------------------------------------------------------------
// RotationModel — owns the axial tilt and continuous spin of ONE body.
// The phase is integrated from frame deltas so live reconfiguration of the
// period changes are continuous (no phase jump).
//
// Orientation  Q = Qtilt * Qspin  where
//   Qtilt = rotation about local Z by axialTiltDeg (tilts the north pole)
//   Qspin = rotation about local Y by accumulated phase
// i.e. Q = Qz(tiltDeg) * Qy(phase).
//
// SINGLE RESPONSIBILITY: "what is this body's orientation right now".
// ----------------------------------------------------------------------
export class RotationModel
{
    #phase = 0;     // accumulated spin angle (radians)
    #omega = 0;     // angular rate (rad / sec)
    #tiltRad = 0;   // axial tilt in radians (around local Z)
    #config;

    // Scratch quaternions — reused every applyToGroup call.
    #qTilt = new THREE.Quaternion();
    #qSpin = new THREE.Quaternion();

    static #Y = new THREE.Vector3(0, 1, 0);
    static #Z = new THREE.Vector3(0, 0, 1);

    constructor(config)
    {
        this.configure(config);
    }

    // (Re)derive cached parameters from the config. The accumulated phase is
    // intentionally preserved so a period or tilt change is seamlessly continuous.
    configure(config)
    {
        this.#config = config ?? {};
        this.#tiltRad = THREE.MathUtils.degToRad(this.#config.axialTiltDeg ?? 0);
        const period = this.#config.rotationPeriodSec ?? 0;
        this.#omega = period > 0 ? (2 * Math.PI) / period : 0;
    }

    get config()
    {
        return this.#config;
    }

    // Advance the spin phase by one frame delta (call once per frame).
    advance(dt)
    {
        this.#phase = (this.#phase + this.#omega * dt) % (2 * Math.PI);
    }

    // Write the composed orientation Q = Qtilt * Qspin to the group's quaternion.
    applyToGroup(group)
    {
        this.#qTilt.setFromAxisAngle(RotationModel.#Z, this.#tiltRad);
        this.#qSpin.setFromAxisAngle(RotationModel.#Y, this.#phase);
        group.quaternion.copy(this.#qTilt).multiply(this.#qSpin);
    }
}
