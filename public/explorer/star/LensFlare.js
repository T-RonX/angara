import * as THREE from 'three';
import { additiveSprite, softGhostTexture, hexGhostTexture } from '../texture/TextureFactory.js';
import { deg2rad } from '../core/MathUtils.js';

// LensFlare ? the chain of subtle additive "ghosts" running from ONE sun
// through screen centre. Each sun casts its own flare along its own
// sun?centre line, so several suns produce several independent flares.
//
// The ghosts are NOT depth-tested (a post-process look), so they're kept
// small and never sit dead-centre (which would read as a blob over the
// planet). The on-sun chromatic halo handles the "halo near the sun" job.
export class LensFlare
{
    #star;
    #elements;
    #tint = new THREE.Color();
    #sizeScale = 1;

    #sunNdc = new THREE.Vector3();
    #tmpPos = new THREE.Vector3();
    #sunCamSpace = new THREE.Vector3();
    #disposed = false;

    constructor(scene, star)
    {
        this.#star = star;
        this.#tint.set(star.color);
        this.#sizeScale = THREE.MathUtils.clamp(star.size / 500, 0.55, 1.75);

        const specs = [
            { offset: 0.22, size: 0.16,  alpha: 0.28, breath: 0.4, tex: softGhostTexture(star.coreColor, 0.65) },
            { offset: 0.42, size: 0.045, alpha: 0.40, breath: 0.3, tex: hexGhostTexture( 35, 256, 0.22) },
            { offset: 0.62, size: 0.035, alpha: 0.45, breath: 0.3, tex: hexGhostTexture(205, 256, 0.20) },
            { offset: 1.25, size: 0.09,  alpha: 0.18, breath: 0.5, tex: softGhostTexture('210, 225, 245', 0.5) },
            { offset: 1.42, size: 0.04,  alpha: 0.50, breath: 0.35, tex: hexGhostTexture(180, 256, 0.18) },
            { offset: 1.78, size: 0.18,  alpha: 0.14, breath: 0.5, tex: softGhostTexture(star.warmColor, 0.4) },
        ];

        this.#elements = specs.map(spec => {
            const sprite = additiveSprite(spec.tex, spec.alpha, /* depthTest */ false);
            sprite.renderOrder = 999;     // draw over everything
            sprite.frustumCulled = false; // we manage visibility ourselves
            sprite.visible = false;
            sprite.material.color.copy(this.#tint);
            scene.add(sprite);

            return { ...spec, size: spec.size * this.#sizeScale, sprite };
        });
    }

    hideAll()
    {
        for (const f of this.#elements) f.sprite.visible = false;
    }

    // Is the sun on screen and in front of the camera? Returns the NDC of
    // the sun (and a flag) so the caller can decide whether to draw.
    project(camera, sunWorldPos)
    {
        this.#sunCamSpace.copy(sunWorldPos).applyMatrix4(camera.matrixWorldInverse);
        const inFront = this.#sunCamSpace.z < 0;

        this.#sunNdc.copy(sunWorldPos).project(camera);
        const onScreen = inFront
            && Math.abs(this.#sunNdc.x) <= 1.2
            && Math.abs(this.#sunNdc.y) <= 1.2;

        return { inFront, onScreen, ndc: this.#sunNdc };
    }

    // Place and fade the chain. `vis` is the smoothed visible fraction.
    place(camera, t, vis)
    {
        const ndc = this.#sunNdc;

        // Fade as the sun nears the viewport edge.
        const edgeDist = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
        const edgeFade = THREE.MathUtils.clamp(1 - (edgeDist - 0.7) / 0.5, 0, 1);
        // A "punch up" near screen centre ? real lenses flare hardest on-axis.
        const centreBoost = THREE.MathUtils.clamp(1 - ndc.length() * 0.5, 0.5, 1.1);
        // The chain dies faster than the disc when the sun is partly covered.
        const chainVis = vis * vis;
        const globalAlpha = this.#star.lensFlareOpacity * edgeFade * centreBoost * chainVis;

        // Viewport height in world units at the overlay depth ? scales each
        // ghost so `size` is a fraction of screen height.
        const overlayDepthNdc = 0.92;
        this.#tmpPos.set(0, 0, overlayDepthNdc).unproject(camera);
        const overlayDist = camera.position.distanceTo(this.#tmpPos);
        const screenWorldHeight = 2 * overlayDist * Math.tan(deg2rad(camera.fov) / 2);

        for (let i = 0; i < this.#elements.length; i++)
        {
            const f = this.#elements[i];
            const ndcX = ndc.x * (1 - f.offset);
            const ndcY = ndc.y * (1 - f.offset);
            this.#tmpPos.set(ndcX, ndcY, overlayDepthNdc).unproject(camera);
            f.sprite.position.copy(this.#tmpPos);

            const phase = i * 0.9;
            const breath = f.breath ?? 0.4;
            const wobble = Math.sin(t * 0.7 + phase) * 0.5 + 0.5;
            const sizeMul  = 1 + (wobble - 0.5) * 0.12 * breath;
            const alphaMul = 1 + (wobble - 0.5) * 0.30 * breath;

            f.sprite.scale.setScalar(f.size * screenWorldHeight * sizeMul);
            f.sprite.material.opacity = f.alpha * globalAlpha * alphaMul;
            f.sprite.material.rotation = (i % 2 === 0 ? 1 : -1) * t * 0.04 + i * 0.4;
            f.sprite.visible = globalAlpha > 0.01;
        }
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const f of this.#elements)
        {
            f.sprite.removeFromParent();

            if (f.sprite.material.map) f.sprite.material.map.dispose();

            f.sprite.material.dispose();
        }

        this.#elements = [];
    }
}
