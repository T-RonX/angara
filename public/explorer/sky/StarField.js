import * as THREE from 'three';
import { blackbodyRgb } from '../texture/ColorUtils.js';

// StarField ? the decorative background stars. A single Points object on a
// far sphere rendered with a tiny custom shader so every star carries its
// own size and colour:
//   * colour from a blackbody curve (mostly white/blue with warm sprinkles),
//   * size power-law distributed (many tiny, a few bright giants),
//   * a per-star brightness multiplier.
// These are scenery, not light sources.
export class StarField
{
    points;
    #disposed = false;

    constructor(starfield, skyDistance)
    {
        this.points = this.#build(starfield, skyDistance);
        this.points.visible = starfield.show;
    }

    #build(starfield, skyDistance)
    {
        const n = starfield.count;
        const positions = new Float32Array(n * 3);
        const colors    = new Float32Array(n * 3);
        const sizes     = new Float32Array(n);

        const tempRange = starfield.tempMax - starfield.tempMin;
        const sizeRange = starfield.sizeMax - starfield.sizeMin;
        const brightRange = starfield.brightnessMax - starfield.brightnessMin;
        const dpr = window.devicePixelRatio || 1;

        for (let i = 0; i < n; i++)
        {
            // Uniform direction on a sphere (z/? method).
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;
            const s = Math.sqrt(1 - u * u);
            positions[i * 3]     = skyDistance * s * Math.cos(phi);
            positions[i * 3 + 1] = skyDistance * u;
            positions[i * 3 + 2] = skyDistance * s * Math.sin(phi);

            // Temperature biased toward the cool end (M/K dwarfs dominate).
            const tBias = 1 - Math.pow(Math.random(), 1 / starfield.tempBias);
            const kelvin = starfield.tempMin + tempRange * tBias;
            const [r, g, b] = blackbodyRgb(kelvin);

            const brightness = starfield.brightnessMin + Math.random() * brightRange;
            colors[i * 3]     = r * brightness;
            colors[i * 3 + 1] = g * brightness;
            colors[i * 3 + 2] = b * brightness;

            // Heavy bias toward the small end via a power-law roll. ?DPR so
            // the visual size is consistent on high-DPI displays.
            const sizeRoll = Math.pow(Math.random(), starfield.sizeBias);
            sizes[i] = (starfield.sizeMin + sizeRange * sizeRoll) * dpr;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            vertexShader: `
                attribute vec3 aColor;
                attribute float aSize;
                varying vec3 vColor;
                void main() {
                    vColor = aColor;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    vec2 c = gl_PointCoord - 0.5;
                    float d = length(c) * 2.0;
                    if (d > 1.0) discard;
                    float a = smoothstep(1.0, 0.15, d);
                    gl_FragColor = vec4(vColor, a);
                }
            `,
        });

        return new THREE.Points(geo, mat);
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}
