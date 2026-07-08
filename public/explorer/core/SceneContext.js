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

    constructor(rootElement, planet)
    {
        this.root = rootElement;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(planet.background);

        // Far plane is generous so distant stars at skyDistance don't clip.
        this.camera = new THREE.PerspectiveCamera(50, 1, 1, 200000);
        this.camera.position.set(0, planet.radius * 1.4, planet.radius * 2.6);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // Clamp the device-pixel-ratio: the full-screen atmosphere raymarch
        // runs per device pixel, so DPR² on hi-DPI screens is the dominant
        // fragment cost. 1.5 keeps edges crisp without the 4×+ fill of DPR 2–3.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.localClippingEnabled = true; // resource-mode slicing
        this.root.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false; // always orbit around the body centre
        this.setDistanceRange(planet);
    }

    // Re-scale the orbit zoom range to a body's own radius. Called once for
    // the primary in the constructor, and again whenever the active body
    // changes (companion selection), so the zoom limits never stay pinned to
    // a differently-sized body and every body's haze/surface stays reachable.
    setDistanceRange(planet)
    {
        this.controls.minDistance = planet.radius * 1.15;
        this.controls.maxDistance = planet.radius * 20;
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
}

