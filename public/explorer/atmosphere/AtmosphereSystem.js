import { OccluderOwner } from './OccluderOwner.js';
import { AtmosphereScheduler } from './AtmosphereScheduler.js';
import { VisibilityPolicy } from './VisibilityPolicy.js';
import * as THREE from 'three';

// AtmosphereSystem ? owns the haze of EVERY body. Each CelestialBody builds
// its own (optional) AtmosphereShell from its own config, and this system:
//   - positions each shell at its body's current world location every frame,
//   - decides which shells are visible (VisibilityPolicy),
//   - drives the throttled scattering render pass + the per-frame composite,
//     feeding each shell the shared sun state.
// SINGLE RESPONSIBILITY: "render every body's atmosphere for this frame".
export class AtmosphereSystem
{
    #registry;
    #starSystem;
    #behaviour;
    #occluderOwner;
    #scheduler;
    #visibilityPolicy;
    #mode = 'view';
    #tmp = new THREE.Vector3();
    #disposed = false;

    constructor(registry, starSystem, behaviour, {
        occluderOwner,
        scheduler,
        visibilityPolicy,
    } = {})
    {
        this.#registry = registry;
        this.#starSystem = starSystem;
        this.#behaviour = behaviour;
        this.#occluderOwner = occluderOwner ?? new OccluderOwner();
        this.#scheduler = scheduler ?? new AtmosphereScheduler();
        this.#visibilityPolicy = visibilityPolicy ?? new VisibilityPolicy();
    }

    #shells()
    {
        return this.#registry.bodies
            .map(body => body.atmosphere)
            .filter(shell => shell !== null && shell !== undefined);
    }

    resize(renderer)
    {
        for (const shell of this.#shells())
        {
            shell.resize(renderer);
        }
    }

    setMode(mode)
    {
        this.#mode = mode;
        this.#visibilityPolicy.apply(mode, this.#registry.bodies, this.#registry.active);
    }

    // Called every frame BEFORE the main scene render: position each visible
    // shell, feed it the sun state, and re-run the (throttled) scattering pass.
    update(now, camera, renderer)
    {
        const dirs = this.#starSystem.directions;
        const colors = this.#starSystem.colors;
        const energies = this.#starSystem.energies();

        // Keep depth-occluder proxies aligned with the bodies (view mode only).
        const useOccluders = this.#mode !== 'resource';

        if (useOccluders)
        {
            this.#occluderOwner.syncPositions(this.#registry.bodies);
        }

        const hz = (this.#behaviour.atmosphere?.updateHz ?? 0) | 0;

        for (const body of this.#registry.bodies)
        {
            const shell = body.atmosphere;

            if (!shell || !shell.mesh.visible) continue;

            shell.setCenter(body.group.getWorldPosition(this.#tmp));
            shell.setSunIntensity(body.atmosphereConfig.sunIntensity);
            shell.updateForCamera(camera);

            if (this.#scheduler.isDue(shell, now, hz))
            {
                shell.setSunDirections(dirs);
                shell.setSunColors(colors);
                shell.setSunEnergies(energies);
                shell.renderPass(renderer, camera, useOccluders ? this.#occluderOwner.scene : null);
            }
        }
    }

    // Called every frame AFTER the main scene render: additively composite each
    // visible shell's cached haze over the frame.
    composite(renderer)
    {
        for (const body of this.#registry.bodies)
        {
            const shell = body.atmosphere;

            if (shell && shell.mesh.visible)
            {
                shell.composite(renderer);
            }
        }
    }

    // Dispose shared infrastructure only. Individual AtmosphereShell instances
    // are owned by their CelestialBody and disposed there.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#occluderOwner.dispose();
        this.#scheduler.dispose();
    }
}
