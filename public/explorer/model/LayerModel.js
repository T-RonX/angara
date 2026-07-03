import * as THREE from 'three';

// ----------------------------------------------------------------------
// LayerModel — derives the crust's per-layer thickness, the cumulative
// radii of each layer, the core radius and a depth-colour palette padded
// to exactly `maxDepth` entries.
//
//   layerThicknesses[d] = thickness of layer d
//   layerRadii[d]       = OUTER radius of layer d
//   layerRadii[maxDepth]= the core radius
// ----------------------------------------------------------------------
export class LayerModel
{
    maxDepth;
    layerThicknesses;
    layerRadii;
    coreRadius;
    depthColors;
    coreColor;

    constructor(planet)
    {
        this.maxDepth = planet.maxDepth;
        this.coreColor = planet.coreColor;
        this.layerThicknesses = this.#deriveThicknesses(planet);
        this.layerRadii = this.#deriveRadii(planet.radius);
        this.coreRadius = this.layerRadii[this.maxDepth];
        this.depthColors = this.#deriveDepthColors(planet.depthColors);
    }

    #deriveThicknesses(planet)
    {
        const explicit = planet.layerThicknesses;

        if (Array.isArray(explicit) && explicit.length >= this.maxDepth)
        {
            return explicit.slice(0, this.maxDepth);
        }

        const out = new Array(this.maxDepth);

        for (let d = 0; d < this.maxDepth; d++)
        {
            out[d] = planet.layerThicknessBase + d * planet.layerThicknessGrowth;
        }

        return out;
    }

    #deriveRadii(planetRadius)
    {
        const out = new Array(this.maxDepth + 1);
        out[0] = planetRadius;

        for (let d = 0; d < this.maxDepth; d++)
        {
            out[d + 1] = out[d] - this.layerThicknesses[d];
        }

        return out;
    }

    // Pad / trim the supplied colours to exactly maxDepth entries,
    // interpolating the last supplied colour toward the core for any gap so
    // the strata visibly deepen into the core.
    #deriveDepthColors(supplied)
    {
        const src = supplied.slice();

        if (src.length >= this.maxDepth)
        {
            return src.slice(0, this.maxDepth);
        }

        const last = new THREE.Color(src[src.length - 1]);
        const core = new THREE.Color(this.coreColor);
        const missing = this.maxDepth - src.length;

        for (let i = 1; i <= missing; i++)
        {
            const t = i / (missing + 1);
            src.push(last.clone().lerp(core, t * 0.5).getHex());
        }

        return src;
    }
}

