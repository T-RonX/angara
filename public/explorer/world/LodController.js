import * as THREE from 'three';

// LodController ? distance-based level of detail for the bodies. The active
// body (and any body large on screen) keeps its FULL detailed, displaced
// surface mesh; a body that is small on screen (a distant companion) is
// swapped for a cheap low-poly impostor sphere whose colour matches the
// surface, since at that apparent size the per-cell detail and the shape
// displacement are sub-pixel anyway.
//
// It measures apparent size as the body's angular radius from the camera
// (radius / distance) and applies hysteresis so a body straddling the
// threshold doesn't flicker between levels. SINGLE RESPONSIBILITY: "pick and
// apply a detail level per body each frame". OPEN/CLOSED: new levels are added
// by extending the impostor factory, not by editing callers.
export class LodController
{
    #registry;
    #camera;
    #cfg;
    #impostors = new Map();   // body ? THREE.Mesh
    #level = new Map();       // body ? 'full' | 'impostor'
    #disposed = false;

    constructor(registry, camera, cfg)
    {
        this.#registry = registry;
        this.#camera = camera;

        this.#cfg = {
            enabled: cfg?.enabled ?? true,
            // Angular radius (radians) below which a body drops to the impostor.
            impostorBelowAngular: cfg?.impostorBelowAngular ?? 0.02,
            hysteresis: cfg?.hysteresis ?? 1.35,
            impostorSegments: cfg?.impostorSegments ?? 24,
        };
    }

    update()
    {
        if (!this.#cfg.enabled) return;

        const camPos = this.#camera.position;

        for (const body of this.#registry.bodies)
        {
            // The active body is always full detail (it can enter resource mode).
            if (body === this.#registry.active)
            {
                this.#apply(body, 'full');

                continue;
            }

            const group = body.group;
            const dist = camPos.distanceTo(group.position);
            const angular = dist > 1e-3 ? body.radius / dist : Infinity;

            const current = this.#level.get(body) ?? 'full';
            const lo = this.#cfg.impostorBelowAngular;
            const hi = lo * this.#cfg.hysteresis;

            let next = current;

            if (current === 'full' && angular < lo) next = 'impostor';
            else if (current === 'impostor' && angular > hi) next = 'full';

            this.#apply(body, next);
        }
    }

    #apply(body, level)
    {
        if (this.#level.get(body) === level) return;

        this.#level.set(body, level);

        const active = body === this.#registry.active;
        const full = active || level === 'full';
        const bodyMesh = body.bodyMesh;

        // Toggle the surface + core (NOT the grid lines, which must stay hidden)
        // against the impostor. The active body is always full detail; because
        // #apply only runs on a LEVEL CHANGE and the active body never changes
        // level, this never fights the resource-mode slice machinery
        // (BodyMesh.hideAll / restoreView) ? it only restores the surface when a
        // body is (re)promoted to full, e.g. when a distant impostor companion
        // is selected and becomes active.
        for (const mesh of bodyMesh.surfaceMeshes)
        {
            if (mesh) mesh.visible = full;
        }

        if (bodyMesh.core) bodyMesh.core.visible = full;

        const existing = this.#impostors.get(body);

        if (full)
        {
            if (existing) existing.visible = false;
        }
        else
        {
            this.#impostorFor(body).visible = true;
        }
    }

    #impostorFor(body)
    {
        let mesh = this.#impostors.get(body);

        if (mesh) return mesh;

        const colors = body.config.depthColors;
        const color = Array.isArray(colors) && colors.length ? colors[0] : 0x808080;

        mesh = new THREE.Mesh(
            new THREE.SphereGeometry(body.radius, this.#cfg.impostorSegments, this.#cfg.impostorSegments),
            new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
        );
        mesh.visible = false;
        body.group.add(mesh);
        this.#impostors.set(body, mesh);

        return mesh;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const mesh of this.#impostors.values())
        {
            mesh.removeFromParent();
            mesh.geometry.dispose();
            mesh.material.dispose();
        }

        this.#impostors.clear();
        this.#level.clear();
    }
}
