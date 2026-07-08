import * as THREE from 'three';

// ----------------------------------------------------------------------
// AtmosphereSystem — owns the haze of EVERY body. Each CelestialBody builds its
// own (optional) AtmosphereShell from its own config, and this system:
//   - positions each shell at its body's current world location every frame
//     (companions orbit away from the origin),
//   - decides which shells are visible (all in view mode; only the active
//     body's in resource mode, and only if it opts in),
//   - drives the throttled scattering render pass + the per-frame composite,
//     feeding each shell the shared sun state.
//
// Splitting this out of BodyExplorer keeps the orchestrator thin and makes the
// haze genuinely per-body (fixes a companion inheriting the primary's sky).
// SINGLE RESPONSIBILITY: "render every body's atmosphere for this frame".
// ----------------------------------------------------------------------
export class AtmosphereSystem
{
    #registry;
    #starSystem;
    #lastRender = new Map();    // shell → last render timestamp (throttle)
    #occluders;                 // scene of depth-only body proxies
    #proxies = new Map();       // body → proxy mesh
    #mode = 'view';
    #tmp = new THREE.Vector3();

    constructor(registry, starSystem)
    {
        this.#registry = registry;
        this.#starSystem = starSystem;
        this.#occluders = new THREE.Scene();
    }

    #shells()
    {
        return this.#registry.bodies
            .map(body => body.atmosphere)
            .filter(shell => shell !== null && shell !== undefined);
    }

    // A cheap opaque sphere per body, sized to its nominal radius, used ONLY as
    // a depth occluder in the haze pre-pass (its material is overridden to
    // colourless depth-only). Nominal radius is deliberately below any displaced
    // peak so a body never eats its OWN limb halo, while still hiding the haze of
    // OTHER bodies it passes in front of.
    #proxyFor(body)
    {
        let mesh = this.#proxies.get(body);

        if (mesh) return mesh;

        mesh = new THREE.Mesh(
            new THREE.SphereGeometry(body.planet.radius, 24, 16),
            new THREE.MeshBasicMaterial(),
        );
        mesh.frustumCulled = false;
        this.#proxies.set(body, mesh);
        this.#occluders.add(mesh);

        return mesh;
    }

    resize(renderer)
    {
        for (const shell of this.#shells())
        {
            shell.resize(renderer);
        }
    }

    // Recompute each shell's visibility for the current mode. In resource mode
    // only the active body's shell may show (the camera is inside it); every
    // other body's haze is hidden so it can't bleed over the sliced view.
    setMode(mode)
    {
        this.#mode = mode;

        const resource = mode === 'resource';
        const active = this.#registry.active;

        for (const body of this.#registry.bodies)
        {
            const shell = body.atmosphere;

            if (!shell) continue;

            const cfg = body.atmosphereConfig;
            const allowed = resource
                ? (body === active && cfg.showInResourceMode)
                : true;

            shell.mesh.visible = cfg.show && allowed;
        }
    }

    // Called every frame BEFORE the main scene render: position each visible
    // shell, feed it the sun state, and re-run the (throttled) scattering pass.
    update(now, camera, renderer)
    {
        const dirs = this.#starSystem.directions;
        const colors = this.#starSystem.colors;
        const energies = this.#starSystem.energies();

        // Keep the depth-occluder proxies aligned with the bodies (view mode
        // only — in resource mode the near geometry is the sliced cliff and only
        // the active shell shows, so no cross-body occlusion is needed).
        const useOccluders = this.#mode !== 'resource';

        if (useOccluders)
        {
            for (const body of this.#registry.bodies)
            {
                this.#proxyFor(body).position.copy(body.group.getWorldPosition(this.#tmp));
            }
        }

        for (const body of this.#registry.bodies)
        {
            const shell = body.atmosphere;

            if (!shell || !shell.mesh.visible) continue;

            shell.setCenter(body.group.getWorldPosition(this.#tmp));
            shell.setSunIntensity(body.atmosphereConfig.sunIntensity);
            shell.updateForCamera(camera);

            const hz = body.atmosphereConfig.updateHz | 0;
            const interval = hz > 0 ? 1000 / hz : 0;
            const last = this.#lastRender.get(shell) ?? -Infinity;

            if (now - last >= interval)
            {
                shell.setSunDirections(dirs);
                shell.setSunColors(colors);
                shell.setSunEnergies(energies);
                shell.renderPass(renderer, camera, useOccluders ? this.#occluders : null);
                this.#lastRender.set(shell, now);
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
}
