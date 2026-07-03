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

    setSunIntensity(value)
    {
        this.#uniforms.uSunIntensity.value = value;
    }
}

