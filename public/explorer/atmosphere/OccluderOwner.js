import * as THREE from 'three';

// Owns the depth-occluder scene used by every AtmosphereShell's renderPass.
// Each body gets one proxy sphere so shells behind a foreground body are
// correctly hidden in the pre-pass, without the active body eating its own
// limb halo (proxy radius = nominal, below any displaced peak).
export class OccluderOwner
{
    #scene;
    #proxies = new Map();
    #tmp = new THREE.Vector3();
    #disposed = false;

    constructor()
    {
        this.#scene = new THREE.Scene();
    }

    get scene() { return this.#scene; }

    proxyFor(body)
    {
        let mesh = this.#proxies.get(body);

        if (mesh) return mesh;

        mesh = new THREE.Mesh(
            new THREE.SphereGeometry(body.radius, 24, 16),
            new THREE.MeshBasicMaterial(),
        );
        mesh.frustumCulled = false;
        this.#proxies.set(body, mesh);
        this.#scene.add(mesh);

        return mesh;
    }

    syncPositions(bodies)
    {
        for (const body of bodies)
        {
            this.proxyFor(body).position.copy(body.group.getWorldPosition(this.#tmp));
        }
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const mesh of this.#proxies.values())
        {
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.#scene.remove(mesh);
        }

        this.#proxies.clear();
    }
}
