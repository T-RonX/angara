import * as THREE from 'three';

// ----------------------------------------------------------------------
// LightingRig — the GLOBAL fill lighting that keeps the unlit ("night")
// side of the body legible. The suns themselves (the directional lights
// that light the day side) live in `Star`; this rig only owns the soft
// floor: ambient + rim + hemisphere + a tiny bottom fill.
//
// That floor is decoupled from the suns: it's held at a constant level
// scaled by `nightDarkness` (0 = pitch-black night side, 1 = full fill),
// so dimming a sun never brightens the shadowed hemisphere.
// ----------------------------------------------------------------------
export class LightingRig
{
    #ambient;
    #rim;
    #hemiFill;
    #bottomFill;
    #cfg;

    constructor(scene, lighting)
    {
        this.#cfg = lighting;

        this.#ambient = new THREE.AmbientLight(0xffffff, lighting.ambientIntensity);
        scene.add(this.#ambient);

        this.#rim = new THREE.DirectionalLight(0x88aaff, lighting.rimIntensity);
        this.#rim.position.set(-1, -0.5, -1);
        scene.add(this.#rim);

        // Hemisphere fill: sky tone for upward faces, warm rock for downward
        // faces — keeps the anti-sun hemisphere visible without flattening
        // the directional sun modelling.
        this.#hemiFill = new THREE.HemisphereLight(
            lighting.hemiSkyColor,
            lighting.hemiGroundColor,
            lighting.hemiIntensity,
        );
        scene.add(this.#hemiFill);

        // A dim directional from below lifts the polar cap cone walls (whose
        // near-horizontal normals get almost nothing from the hemisphere).
        this.#bottomFill = new THREE.DirectionalLight(0xffe0c0, lighting.bottomFillIntensity);
        this.#bottomFill.position.set(0, -1, 0);
        scene.add(this.#bottomFill);
    }

    // Apply the night-darkness floor. `night` is 0..1.
    applyNight(night)
    {
        this.#ambient.intensity    = this.#cfg.ambientIntensity    * night;
        this.#rim.intensity        = this.#cfg.rimIntensity        * night;
        this.#hemiFill.intensity   = this.#cfg.hemiIntensity       * night;
        this.#bottomFill.intensity = this.#cfg.bottomFillIntensity * night;
    }
}

