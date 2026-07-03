import {
    additiveSprite,
    sunCoreTexture,
    sunHaloTexture,
    rainbowHaloTexture,
    starburstTexture,
} from '../texture/TextureFactory.js';
import { deg2rad } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// SunVisual — the on-screen disc for ONE sun: a hot core, a soft corona,
// a chromatic halo ring and an anamorphic starburst, all additive sprites
// painted from this sun's own tints. They live under the SkyAnchor so they
// sit at infinity.
//
// Each sun owns its own SunVisual, which is what lets several suns glow
// with independent colours and sizes at once.
// ----------------------------------------------------------------------
export class SunVisual
{
    #core;
    #halo;
    #chromaRing;
    #starburst;
    #star;

    constructor(skyAnchor, star)
    {
        this.#star = star;

        const tints = {
            coreColor: star.coreColor,
            warmColor: star.warmColor,
            rimColor:  star.rimColor,
        };

        this.#core      = additiveSprite(sunCoreTexture(tints), 1.0, true);
        this.#halo      = additiveSprite(sunHaloTexture(tints), star.haloOpacity, true);
        this.#chromaRing = additiveSprite(rainbowHaloTexture(tints), star.chromaRingOpacity, true);
        this.#starburst = additiveSprite(
            starburstTexture(tints, 1024, star.starburstPrimaryRays, star.starburstSecondaryRays),
            star.starburstOpacity, true,
        );

        // Draw order: halo < starburst < chroma ring < core.
        this.#halo.renderOrder      = 0;
        this.#starburst.renderOrder = 1;
        this.#chromaRing.renderOrder = 2;
        this.#core.renderOrder      = 3;

        skyAnchor.add(this.#halo);
        skyAnchor.add(this.#starburst);
        skyAnchor.add(this.#chromaRing);
        skyAnchor.add(this.#core);
    }

    // Position the sprites along the sun direction at `skyDistance`, scale
    // them to the configured sizes, and reflect the show flag.
    place(direction, skyDistance)
    {
        const star = this.#star;
        const pos = direction.clone().multiplyScalar(skyDistance);

        for (const s of this.#sprites()) s.position.copy(pos);

        const coreScale = star.size * 2;
        this.#core.scale.setScalar(coreScale);
        this.#halo.scale.setScalar(coreScale * star.haloScale);
        this.#chromaRing.scale.setScalar(coreScale * star.chromaRingScale);
        this.#starburst.scale.setScalar(coreScale * star.starburstScale);

        for (const s of this.#sprites()) s.visible = star.show;

        this.#halo.material.opacity      = star.haloOpacity;
        this.#chromaRing.material.opacity = star.chromaRingOpacity;
        this.#starburst.material.opacity = star.starburstOpacity;
    }

    // Slowly rotate the chroma ring and starburst so they read as detail.
    animate(t)
    {
        this.#chromaRing.material.rotation = t * deg2rad(this.#star.chromaRingSpeed);
        this.#starburst.material.rotation  = t * deg2rad(this.#star.starburstSpeed);
    }

    // Fade the disc elements by the smoothed visible fraction (0..1). Each
    // element's CONFIGured base opacity stays authoritative.
    applyDiscVisibility(vis)
    {
        const star = this.#star;
        this.#core.material.opacity      = vis;
        this.#halo.material.opacity      = star.haloOpacity      * Math.sqrt(Math.max(0, vis));
        this.#chromaRing.material.opacity = star.chromaRingOpacity * vis;
        this.#starburst.material.opacity = star.starburstOpacity * vis;
    }

    #sprites()
    {
        return [this.#core, this.#halo, this.#chromaRing, this.#starburst];
    }
}

