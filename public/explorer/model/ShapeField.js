import {
    effectiveDisplacement,
    TerrainField,
} from '../texture/procedural/TerrainField.js';

// ----------------------------------------------------------------------
// Three.js adapter around the shared pure terrain field.
// ----------------------------------------------------------------------
export class ShapeField
{
    #size;
    #field;
    #maxDisplacement;
    #cache = new WeakMap(); // memoise surfaceRadius per (shared) corner vector

    constructor(shape, size, seed, terrain)
    {
        this.#size = size;
        const axis = shape?.axisScale ?? [1, 1, 1];
        this.#field = new TerrainField(seed, terrain, axis);
        this.#maxDisplacement = effectiveDisplacement(terrain);
    }

    get terrainField() { return this.#field; }

    get isSphere()
    {
        return this.#maxDisplacement === 0;
    }

    // Lower bound on the surface radius in any direction (deepest valley).
    // Used with maxRadius to compute the effective crust thickness for camera framing.
    get minRadius()
    {
        return this.#size * (1 - this.#maxDisplacement);
    }

    // Upper bound on the surface radius in any direction. Used as the "whole
    // body" start of the resource-mode clip sweep so no displaced peak is
    // clipped at the start of the fly-in.
    get maxRadius()
    {
        return this.#size * (1 + this.#maxDisplacement);
    }

    // Radial scale factor `k` in a given unit direction (1 = base radius).
    radiusScale(dir)
    {
        return 1 + this.#field.sampleElevation(dir.x, dir.y, dir.z) * this.#maxDisplacement;
    }

    // Absolute surface radius in a given unit direction, memoised on the shared
    // corner vector so repeated per-depth builds don't re-run the noise.
    surfaceRadius(dir)
    {
        const hit = this.#cache.get(dir);

        if (hit !== undefined) return hit;

        const r = this.#size * this.radiusScale(dir);
        this.#cache.set(dir, r);

        return r;
    }

}
