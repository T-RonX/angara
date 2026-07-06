import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders.js';

// ----------------------------------------------------------------------
// AtmosphereShell — the visible haze: a back-/front-face sphere slightly
// larger than the planet whose shader integrates Rayleigh + Mie scattering
// along the view ray. It is N-sun aware: the sun directions are fed in as
// an array and the shader sums each sun's contribution.
// ----------------------------------------------------------------------
export class AtmosphereShell
{
    mesh;
    radius;
    shellHeight;

    #uniforms;
    // Offscreen caching: the haze mesh lives in its own private scene and is
    // rendered into #target at a throttled cadence (renderPass); a fullscreen
    // additive quad (#quadScene) re-composites that cached texture over the
    // main frame every displayed frame (composite).
    #scene;
    #target;
    #quadScene;
    #quadCamera;

    constructor(planet, atmosphere, numSuns)
    {
        this.radius = planet.radius * (1 + atmosphere.thickness);
        this.shellHeight = this.radius - planet.radius;

        const sunDirs = [];

        for (let i = 0; i < numSuns; i++)
        {
            sunDirs.push(new THREE.Vector3(1, 0, 0));
        }

        this.#uniforms = {
            uPlanetRadius:  { value: planet.radius },
            uAtmosRadius:   { value: this.radius },
            uSunDir:        { value: sunDirs },
            uSunIntensity:  { value: atmosphere.sunIntensity },
            uOpacity:       { value: atmosphere.opacity },
            uBaseColor:     { value: new THREE.Vector3(...atmosphere.baseColor) },
            uRayleighCoeff: { value: new THREE.Vector3(...atmosphere.rayleighCoeff) },
            // Scale heights are fractions of the shell thickness.
            uRayleighScale: { value: this.shellHeight * atmosphere.rayleighScaleFrac },
            uMieCoeff:      { value: atmosphere.mieCoeff },
            uMieScale:      { value: this.shellHeight * atmosphere.mieScaleFrac },
            uMieG:          { value: atmosphere.mieG },
            uPlanetCenter:  { value: new THREE.Vector3(0, 0, 0) },
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.#uniforms,
            transparent: true,
            // Side is chosen per-frame by updateForCamera(): FrontSide from
            // orbit (camera outside → near faces draw over the disc, unchanged
            // look) and BackSide in resource mode where the camera sits INSIDE
            // the shell (only the inner faces face it). A static FrontSide
            // culled everything from inside, so the scattering vanished there.
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            defines: {
                I_STEPS:  atmosphere.viewSteps | 0,
                J_STEPS:  atmosphere.lightSteps | 0,
                NUM_SUNS: Math.max(1, numSuns | 0),
            },
            vertexShader,
            fragmentShader,
        });

        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(this.radius, 96, 64),
            material,
        );
        this.mesh.visible = atmosphere.show;
        this.mesh.renderOrder = 1; // after the planet so depth test works

        this.#buildCache();
    }

    // The haze is rendered in isolation into a render target so the costly
    // scattering integral can run at a throttled cadence while a cheap quad
    // re-composites the cached result every frame.
    #buildCache()
    {
        this.#scene = new THREE.Scene();
        this.#scene.add(this.mesh);

        // Sized on the first resize(); linear/no-decode so compositing the
        // shader's raw output is pixel-identical to drawing it straight to the
        // canvas. MSAA keeps the sphere silhouette as smooth as the AA canvas.
        this.#target = new THREE.WebGLRenderTarget(1, 1, {
            depthBuffer: false,
            stencilBuffer: false,
            samples: 4,
        });
        this.#target.texture.colorSpace = THREE.NoColorSpace;

        // Fullscreen additive composite. A raw passthrough shader (no colour
        // conversion) so the cached texel is added exactly as the mesh would
        // have blended it. The vertex shader ignores the camera.
        const quadMaterial = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: this.#target.texture } },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `,
            fragmentShader: /* glsl */`
                varying vec2 vUv;
                uniform sampler2D tDiffuse;
                void main() { gl_FragColor = texture2D(tDiffuse, vUv); }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
        });

        this.#quadScene = new THREE.Scene();
        this.#quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMaterial));
        this.#quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    // Copy the current sun directions into the shader uniform array.
    setSunDirections(directions)
    {
        const target = this.#uniforms.uSunDir.value;

        for (let i = 0; i < target.length; i++)
        {
            target[i].copy(directions[i] ?? directions[directions.length - 1]);
        }
    }

    // Render the near faces from orbit but the inner faces once the camera
    // dives inside the shell (resource mode), so the haze is visible in both.
    updateForCamera(camera)
    {
        const inside = camera.position.length() < this.radius;
        const side = inside ? THREE.BackSide : THREE.FrontSide;

        if (this.mesh.material.side !== side)
        {
            this.mesh.material.side = side;
        }
    }

    // Recompute the scattering into the cached render target (call at the
    // throttled cadence). No-op while the haze is hidden.
    renderPass(renderer, camera)
    {
        if (!this.mesh.visible) return;

        const prevTarget = renderer.getRenderTarget();
        const prevColor = renderer.getClearColor(new THREE.Color());
        const prevAlpha = renderer.getClearAlpha();

        renderer.setRenderTarget(this.#target);
        renderer.setClearColor(0x000000, 0); // transparent so empty sky adds nothing
        renderer.render(this.#scene, camera);

        renderer.setRenderTarget(prevTarget);
        renderer.setClearColor(prevColor, prevAlpha);
    }

    // Additively blend the cached haze over the already-rendered main frame.
    composite(renderer)
    {
        if (!this.mesh.visible) return;

        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(this.#quadScene, this.#quadCamera);
        renderer.autoClear = prevAutoClear;
    }

    // Keep the cache resolution matched to the canvas (device pixels).
    resize(renderer)
    {
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        this.#target.setSize(Math.max(1, size.x), Math.max(1, size.y));
    }

    setSunIntensity(value)
    {
        this.#uniforms.uSunIntensity.value = value;
    }
}

