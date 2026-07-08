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
    layerFrac;
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
        this.layerFrac = this.#deriveLayerFrac(planet.radius);
        this.depthColors = this.#deriveDepthColors(planet.depthColors);
    }

    #deriveThicknesses(planet)
    {
        const explicit = planet.layerThicknesses;

        const raw = (Array.isArray(explicit) && explicit.length >= this.maxDepth)
            ? explicit.slice(0, this.maxDepth)
            : Array.from({ length: this.maxDepth }, (_, d) =>
                planet.layerThicknessBase + d * planet.layerThicknessGrowth);

        return this.#fitToRadius(raw, planet.radius);
    }

    // The configured (absolute) thicknesses are tuned for a large body; on a
    // SMALL body their sum can meet or exceed the radius, which would drive the
    // core radius to zero or negative and produce a degenerate hexsphere. Clamp
    // the crust to a fraction of the radius so a positive core always remains,
    // scaling every layer proportionally (so the strata keep their relative
    // thickness). Large bodies are unaffected (their sum is already well under
    // the cap), so existing bodies are pixel-identical.
    #fitToRadius(thicknesses, radius)
    {
        const maxCrustFraction = 0.85; // keep >= 15% of the radius as core
        const total = thicknesses.reduce((s, t) => s + t, 0);
        const cap = radius * maxCrustFraction;

        if (total <= cap || total <= 0)
        {
            return thicknesses;
        }

        const scale = cap / total;

        return thicknesses.map(t => t * scale);
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

    // Fraction of the way from the core (0) to the surface (1) for each layer
    // boundary. On a displaced (irregular) body the crust column is scaled
    // between the FIXED core and the displaced surface using these fractions,
    // so the crust always spans core→surface with no layer inversion and layer
    // thicknesses track the local crust thickness.
    //
    //   frac[0] = 1 (surface) … frac[maxDepth] = 0 (core)
    #deriveLayerFrac(planetRadius)
    {
        const crust = planetRadius - this.coreRadius;
        const out = new Array(this.maxDepth + 1);

        for (let d = 0; d <= this.maxDepth; d++)
        {
            out[d] = crust > 0 ? (this.layerRadii[d] - this.coreRadius) / crust : 0;
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

