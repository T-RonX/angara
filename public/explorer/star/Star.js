import * as THREE from 'three';
import { azElDirection } from '../core/MathUtils.js';
import { SunVisual } from './SunVisual.js';
import { LensFlare } from './LensFlare.js';
import { SunOcclusion } from './SunOcclusion.js';

// Star ? ONE complete light source. It bundles everything a sun needs:
//   * a directional light that actually lights the body's day side,
//   * a SunVisual (disc + corona + chromatic halo + starburst),
//   * a LensFlare chain,
//   * a SunOcclusion test that fades the glow when the body crosses it.
//
// Because every sun is a self-contained Star, the renderer scales to any
// number of suns simply by creating more of them (see StarSystem).
export class Star
{
    // The current unit direction from the planet toward this sun.
    direction = new THREE.Vector3();

    #light;
    #visual;
    #flare;
    #occlusion;
    #skyDistance;
    #sunWorldPos = new THREE.Vector3();

    // EMA-smoothed visible fraction of the disc (0 = covered, 1 = clear).
    #visibility = 1;
    #disposed = false;

    constructor(scene, skyAnchor, starConfig, { skyDistance })
    {
        // Copy the config onto the instance so the HUD can mutate az/el/
        // intensity and the visual/flare read the tints directly.
        Object.assign(this, starConfig);

        this.#skyDistance = skyDistance;

        // Linear-space copy of the light colour, used as the atmosphere's
        // illuminant spectrum (the scattering pass renders in NoColorSpace).
        this.colorRGB = new THREE.Color(this.color).convertSRGBToLinear();

        this.#light = new THREE.DirectionalLight(this.color, this.intensity);
        scene.add(this.#light);

        this.#visual = new SunVisual(skyAnchor, this);
        this.#flare = new LensFlare(scene, this);
        this.#occlusion = new SunOcclusion();

        this.refresh();
    }

    // Recompute everything that depends on the sun's direction / intensity.
    // Called on init and whenever the HUD moves the sun.
    refresh()
    {
        this.direction.copy(azElDirection(this.azimuth, this.elevation));
        this.#light.position.copy(this.direction).multiplyScalar(this.#skyDistance);
        this.#light.intensity = this.intensity;
        this.#visual.place(this.direction, this.#skyDistance);
    }

    setOcclusionBodies(bodies)
    {
        this.#occlusion.setBodies(bodies);
    }

    // Per-frame: animate the disc, measure occlusion and place the flare.
    update(now, camera)
    {
        const t = now * 0.001;

        this.#visual.animate(t);
        this.#flare.hideAll();

        if (!this.show)
        {
            this.#visibility = 0;
            this.#visual.applyDiscVisibility(0);

            return;
        }

        // Ensure matrices reflect this frame's camera movement.
        camera.updateMatrixWorld();

        // The disc lives under the camera-tracked SkyAnchor, so its world
        // position is direction ? skyDistance offset by the camera.
        this.#sunWorldPos.copy(this.direction)
            .multiplyScalar(this.#skyDistance)
            .add(camera.position);

        const { inFront, onScreen } = this.#flare.project(camera, this.#sunWorldPos);

        const measured = inFront ? this.#occlusion.measure(camera, this.#sunWorldPos, this.size) : 0;
        // Soft cinematic fade-in when uncovering; fast hide (?4) when the
        // body crosses in front so the glow never lingers on the silhouette.
        const ease = measured < this.#visibility
            ? Math.min(1, this.flareOcclusionEase * 4)
            : this.flareOcclusionEase;
        this.#visibility += (measured - this.#visibility) * ease;
        const vis = this.#visibility;

        this.#visual.applyDiscVisibility(vis);

        if (!this.showLensFlare || !onScreen || vis < 0.01)
        {
            return;
        }

        this.#flare.place(camera, t, vis);
    }

    setAzimuth(deg)   { this.azimuth = deg; this.refresh(); }
    setElevation(deg) { this.elevation = deg; this.refresh(); }
    setIntensity(v)   { this.intensity = v; this.refresh(); }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#light.removeFromParent();
        this.#visual.dispose();
        this.#flare.dispose();
        this.#occlusion.dispose();
    }
}
