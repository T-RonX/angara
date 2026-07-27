import * as THREE from 'three';

import { buildRingProfile } from './RingProfile.js';
import { ringProfileShader } from './RingShader.js';

const DEG_TO_RAD = Math.PI / 180;

export class RingSystem
{
    mesh;

    #texture;
    #material;
    #shadowUniforms;
    #body;
    #worldQuaternion = new THREE.Quaternion();
    #parentWorldQuaternion = new THREE.Quaternion();
    #axialTilt = new THREE.Quaternion();
    #ringOrientation = new THREE.Quaternion();
    #worldOrientation = new THREE.Quaternion();
    #normal = new THREE.Vector3();
    #baseNormal = new THREE.Vector3(0, 0, 1);
    #disposed = false;

    static #Z_AXIS = new THREE.Vector3(0, 0, 1);

    constructor(body, bodyShadowRadius, starCount)
    {
        this.#body = body;
        const config = body.rings;
        const profile = buildRingProfile(config, body.seed);
        const innerRadius = config.innerRadius * body.radius;
        const outerRadius = config.outerRadius * body.radius;

        this.#texture = new THREE.DataTexture(
            profile.data,
            profile.width,
            1,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
        );
        this.#texture.name = `RingProfile:${body.id}`;
        this.#texture.colorSpace = THREE.SRGBColorSpace;
        this.#texture.wrapS = THREE.ClampToEdgeWrapping;
        this.#texture.wrapT = THREE.ClampToEdgeWrapping;
        this.#texture.minFilter = THREE.LinearFilter;
        this.#texture.magFilter = THREE.LinearFilter;
        this.#texture.generateMipmaps = false;
        this.#texture.needsUpdate = true;

        const sunDirections = [];
        const sunColors = [];
        const sunEnergies = [];

        for (let i = 0; i < starCount; i++)
        {
            sunDirections.push(new THREE.Vector3(1, 0, 0));
            sunColors.push(new THREE.Vector3(1, 1, 1));
            sunEnergies.push(1);
        }

        this.#shadowUniforms = {
            uRingProfile: { value: this.#texture },
            uRingProfileWidth: { value: profile.width },
            uRingInnerRadius: { value: innerRadius },
            uRingOuterRadius: { value: outerRadius },
            uRingCenterWorld: { value: new THREE.Vector3() },
            uRingNormalWorld: { value: new THREE.Vector3(0, 1, 0) },
            uRingSunDirection: { value: sunDirections },
        };

        this.#material = new THREE.ShaderMaterial({
            name: `PlanetaryRings:${body.id}`,
            uniforms: {
                ...this.#shadowUniforms,
                uBodyShadowRadius: { value: bodyShadowRadius },
                uSunDirection: { value: sunDirections },
                uSunColor: { value: sunColors },
                uSunEnergy: { value: sunEnergies },
                uAmbient: { value: config.ambient },
                uDiffuse: { value: config.diffuse },
                uForwardScattering: { value: config.forwardScattering },
                uBackScattering: { value: config.backScattering },
            },
            defines: {
                NUM_SUNS: Math.max(1, starCount | 0),
            },
            vertexShader: ringVertexShader,
            fragmentShader: ringFragmentShader,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(
            new THREE.RingGeometry(innerRadius, outerRadius, 256, 1),
            this.#material,
        );
        this.mesh.name = `PlanetaryRings:${body.id}`;
        this.mesh.renderOrder = 1;
        this.mesh.raycast = () => {};
        this.#orient(body, config);
    }

    get shadowUniforms()
    {
        return this.#shadowUniforms;
    }

    #orient(body, config)
    {
        const node = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            (config.ascendingNodeDeg ?? 0) * DEG_TO_RAD,
        );
        const inclination = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            (config.inclinationDeg ?? 0) * DEG_TO_RAD,
        );
        const equatorial = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -Math.PI / 2,
        );

        this.#ringOrientation.copy(node)
            .multiply(inclination)
            .multiply(equatorial);
        this.#updateWorldOrientation();
        this.mesh.quaternion.copy(this.#worldOrientation);
    }

    #updateWorldOrientation()
    {
        this.#axialTilt.setFromAxisAngle(
            RingSystem.#Z_AXIS,
            (this.#body.axialTiltDeg ?? 0) * DEG_TO_RAD,
        );
        this.#worldOrientation.copy(this.#axialTilt).multiply(this.#ringOrientation);
    }

    updateLighting(directions, colors, energies)
    {
        if (this.#disposed) return;

        this.#updateWorldOrientation();

        if (this.mesh.parent)
        {
            this.mesh.parent.getWorldQuaternion(this.#parentWorldQuaternion);
            this.mesh.quaternion.copy(this.#parentWorldQuaternion)
                .invert()
                .multiply(this.#worldOrientation);
            this.mesh.updateMatrixWorld(true);
        }

        this.mesh.getWorldPosition(this.#shadowUniforms.uRingCenterWorld.value);
        this.mesh.getWorldQuaternion(this.#worldQuaternion);
        this.#normal.copy(this.#baseNormal)
            .applyQuaternion(this.#worldQuaternion)
            .normalize();
        this.#shadowUniforms.uRingNormalWorld.value.copy(this.#normal);

        const targetDirections = this.#material.uniforms.uSunDirection.value;
        const targetColors = this.#material.uniforms.uSunColor.value;
        const targetEnergies = this.#material.uniforms.uSunEnergy.value;

        for (let i = 0; i < targetDirections.length; i++)
        {
            const direction = directions[i] ?? directions[directions.length - 1];
            const color = colors[i] ?? colors[colors.length - 1];
            targetDirections[i].copy(direction);
            targetColors[i].set(color.r, color.g, color.b);
            targetEnergies[i] = energies[i] ?? energies[energies.length - 1];
        }
    }

    setLodVisible(visible)
    {
        this.mesh.visible = visible;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        this.#material.dispose();
        this.#texture.dispose();
    }
}

const ringVertexShader = /* glsl */`
varying vec3 vWorldPosition;
varying float vRingRadius;

void main()
{
    vRingRadius = length(position.xy);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const ringFragmentShader = /* glsl */`
varying vec3 vWorldPosition;
varying float vRingRadius;

${ringProfileShader}
uniform vec3 uRingCenterWorld;
uniform vec3 uRingNormalWorld;
uniform float uBodyShadowRadius;
uniform vec3 uSunDirection[NUM_SUNS];
uniform vec3 uSunColor[NUM_SUNS];
uniform float uSunEnergy[NUM_SUNS];
uniform float uAmbient;
uniform float uDiffuse;
uniform float uForwardScattering;
uniform float uBackScattering;

float bodyVisibility(vec3 worldPosition, vec3 lightDirection)
{
    vec3 origin = worldPosition - uRingCenterWorld;
    float projection = dot(origin, lightDirection);
    float discriminant = projection * projection
        - (dot(origin, origin) - uBodyShadowRadius * uBodyShadowRadius);

    if (discriminant <= 0.0)
    {
        return 1.0;
    }

    return -projection - sqrt(discriminant) > 0.001 ? 0.0 : 1.0;
}

void main()
{
    vec4 profile = sampleRingProfile(vRingRadius);

    if (profile.a <= 0.001)
    {
        discard;
    }

    vec3 normal = normalize(uRingNormalWorld);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 illumination = vec3(uAmbient);

    for (int i = 0; i < NUM_SUNS; i++)
    {
        vec3 lightDirection = normalize(uSunDirection[i]);
        float visibility = bodyVisibility(vWorldPosition, lightDirection);
        float incidence = abs(dot(normal, lightDirection));
        float phaseCosine = -dot(viewDirection, lightDirection);
        float scattering = uForwardScattering * pow(max(phaseCosine, 0.0), 4.0)
            + uBackScattering * pow(max(-phaseCosine, 0.0), 2.0);
        illumination += uSunColor[i] * uSunEnergy[i] * visibility
            * (uDiffuse * incidence + scattering);
    }

    gl_FragColor = vec4(profile.rgb * illumination, profile.a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;
