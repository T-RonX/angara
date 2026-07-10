import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ----------------------------------------------------------------------
// SceneContext — owns the Three.js plumbing: renderer, scene, perspective
// camera and the orbit controls. Nothing game-specific lives here; it just
// gives the rest of the app a configured stage to draw on.
// ----------------------------------------------------------------------
export class SceneContext
{
    root;
    scene;
    camera;
    renderer;
    controls;

    #disposed = false;

    constructor(rootElement, body, sceneCfg, cameraCfg = {})
    {
        this.root = rootElement;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(sceneCfg.background);

        this.camera = new THREE.PerspectiveCamera(
            sceneCfg.fov,
            1,
            sceneCfg.near,
            sceneCfg.far,
        );
        this.camera.position.set(0, body.radius * 1.4, body.radius * 2.6);

        this.renderer = new THREE.WebGLRenderer({ antialias: sceneCfg.antialias });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, sceneCfg.maxPixelRatio));
        this.renderer.localClippingEnabled = true;
        this.root.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = cameraCfg.dampingFactor;
        this.controls.enablePan = false;
        this.setDistanceRange(body, cameraCfg);
    }

    // Re-scale the orbit zoom range to a body's own radius. Called once for
    // the primary in the constructor, and again whenever the active body
    // changes (companion selection), so the zoom limits never stay pinned to
    // a differently-sized body and every body's haze/surface stays reachable.
    setDistanceRange(body, cameraCfg)
    {
        this.controls.minDistance = body.radius * cameraCfg.minDistanceFactor;
        this.controls.maxDistance = body.radius * cameraCfg.maxDistanceFactor;
    }

    resize()
    {
        const w = this.root.clientWidth;
        const h = this.root.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    render()
    {
        this.renderer.render(this.scene, this.camera);
    }

    get domElement()
    {
        return this.renderer.domElement;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.controls.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
