// ----------------------------------------------------------------------
// PHYSICAL configuration — "what the body and its sky ARE".
//
// This is pure DATA: the planet, its crust layers, the atmosphere, the
// light sources (suns) and the background star field. No behaviour lives
// here. Eventually this exact shape will be delivered by the backend, so
// keep it serialisable (plain numbers / strings / arrays only).
// ----------------------------------------------------------------------
export const physical = {
    // ------------------------------------------------------------------
    // The planet itself: its size, how finely it is gridded, and how its
    // crust is layered from the surface down to the core.
    // ------------------------------------------------------------------
    planet: {
        radius:   500,            // radius of the body
        cellTopology: 'hexsphere',
        // Hexsphere subdivision frequency (icosahedron edge divisions). The
        // surface has 10·f²+2 cells; keep modest (e.g. 12–24).
        hexFrequency: 16,
        maxDepth: 5,              // number of crust layers (any reasonable number)

        // Per-layer thickness (length must be >= maxDepth; entries past
        // maxDepth are ignored). Set to null to auto-generate a sensible
        // monotonically-thickening default.
        layerThicknesses: null,
        // Auto-thickness knobs (only used when `layerThicknesses === null`):
        //   thickness(d) = layerThicknessBase + d * layerThicknessGrowth
        layerThicknessBase:   10,
        layerThicknessGrowth: 2,

        // The "core" sphere shown beneath the deepest crust layer.
        coreColor: 0xc9743a,
        // One colour per depth layer (ex ind0 = surface … deeper). Padded
        // toward `coreColor` automatically when shorter than maxDepth.
        depthColors: [0x6f8b57, 0x8a6d3b, 0x2a2f3a],

        // RESERVED for future texturing of the VISIBLE layer faces. When
        // these become arrays (one entry per visible layer) the material
        // factory will skin the crust faces with them. Null = the flat
        // `depthColors` look used today.
        layerTextures:    null,   // future: [url | null, …] per visible layer
        layerNormalMaps:  null,   // future: [url | null, …] per visible layer

        gridColor:  0x0a0e16,
        background: 0x05070d,
        cellGap:    0.0,          // gap between cells (fraction); 0 = touching
    },

    // ------------------------------------------------------------------
    // The atmosphere — an analytical single-scattering Rayleigh + Mie
    // shell. Every knob is exposed so the look can be retuned per planet.
    // ------------------------------------------------------------------
    atmosphere: {
        show:        true,
        // Whether the atmosphere is a selectable cell shell (hover / pick /
        // highlight in resource mode). The visible haze is the shader either
        // way; this only governs interactivity.
        selectable:  true,
        // Thickness as a fraction of `planet.radius`.
        thickness:   0.03,
        // Sun energy poured into the atmosphere integral (independent from a
        // sun's surface-lighting intensity). Shared by all suns.
        sunIntensity: 1.0,
        opacity:     1.0,
        // Base colour participates in the PHYSICS (multiplies the Rayleigh
        // coefficient), which is what gives the blue-day / red-terminator look.
        baseColor:      [0.34, 0.77, 1.89],
        rayleighCoeff:  [0.222, 0.222, 0.222],
        // Scale heights as a FRACTION of the shell thickness.
        rayleighScaleFrac: 0.30,
        mieScaleFrac:      0.12,
        mieCoeff:    0.21,
        mieG:        0.76,
        viewSteps:   12,
        lightSteps:  6,
        // Cap the scattering raymarch to this many recomputes per second. The
        // pass renders into a cached texture that is re-composited every frame,
        // so the expensive integral is decoupled from the display frame rate.
        // The cache is view-dependent, so it lags slightly while the camera
        // moves. 0 = recompute every frame (no throttling).
        updateHz:    30
    },

    // ------------------------------------------------------------------
    // Sky-wide constants and the fill lights that keep the night side
    // legible. The `nightDarkness` floor is decoupled from the suns.
    // ------------------------------------------------------------------
    lighting: {
        skyDistance: 80000,       // radius the sun/stars sit at (≈ infinity)
        // Fill lights (the unlit-side floor). Held at a constant level
        // scaled by `nightDarkness`: 0 = pitch-black night side, 1 = full.
        ambientIntensity:    0.12,
        rimIntensity:        0.4,
        nightDarkness:       0.1,
        hemiSkyColor:        0xa8c0e8,
        hemiGroundColor:     0xa37a52,
        hemiIntensity:       0.85,
        bottomFillIntensity: 0.18,
    },

    // ------------------------------------------------------------------
    // The SUNS. Each entry is a complete light source: it lights the
    // surface (one directional light each), draws its own sun disc +
    // corona + chromatic halo + starburst, and casts its own lens flare.
    // Add or remove entries freely — the HUD builds its controls from this
    // list automatically.
    // ------------------------------------------------------------------
    stars: [
        {
            name:      'Sun',
            azimuth:   35,         // degrees around Y (0 = +X, 90 = +Z)
            elevation: 35,         // degrees above the equator (-90..90)
            intensity: 1.1,        // surface-lighting strength
            color:     0xffffff,   // directional-light colour
            distance:  8000,       // distance of the visible sun disc
            size:      500,        // radius of the visible sun disc

            // Soft additive corona (multiple of `size`).
            haloScale:   3.0,
            haloOpacity: 0.55,
            // Chromatic halo ring just outside the sun.
            chromaRingScale:   2.10,
            chromaRingOpacity: 0.42,
            chromaRingSpeed:   2.5,
            // Starburst rays through the sun.
            starburstScale:    3.6,
            starburstOpacity:  0.45,
            starburstSpeed:    -2,
            starburstPrimaryRays:   6,
            starburstSecondaryRays: 8,

            // Temporal ease for the occlusion fade.
            flareOcclusionEase: 0.18,
            // Tints for the procedural sun + flare textures (r,g,b 0-255).
            coreColor: '255, 248, 220',
            warmColor: '255, 180,  90',
            rimColor:  '255,  90,  35',

            show:            true,
            showLensFlare:   true,
            lensFlareOpacity: 0.25,
        },
        {
            // A second, cooler companion sun — demonstrates that everything
            // (lighting, sun disc, halo, starburst, flare and the atmosphere
            // scattering) now scales to MANY suns.
            name:      'Companion',
            azimuth:   210,
            elevation: 20,
            intensity: 0.45,
            color:     0xcdd9ff,
            distance:  8000,
            size:      320,

            haloScale:   3.0,
            haloOpacity: 0.40,
            chromaRingScale:   2.10,
            chromaRingOpacity: 0.30,
            chromaRingSpeed:   -1.8,
            starburstScale:    3.2,
            starburstOpacity:  0.30,
            starburstSpeed:     1.4,
            starburstPrimaryRays:   6,
            starburstSecondaryRays: 8,

            flareOcclusionEase: 0.18,
            coreColor: '220, 235, 255',
            warmColor: '150, 190, 255',
            rimColor:  '60,  110, 220',

            show:            true,
            showLensFlare:   true,
            lensFlareOpacity: 0.18,
        },
    ],

    // ------------------------------------------------------------------
    // The background star field (decorative; not light sources).
    // ------------------------------------------------------------------
    starfield: {
        show:  true,
        count: 2500,
        // Per-star pixel size (power-law biased toward the small end).
        sizeMin:  0.6,
        sizeMax:  3.5,
        sizeBias: 4,
        // Per-star blackbody colour temperature range (Kelvin).
        tempMin:  3000,
        tempMax:  12000,
        tempBias: 2,
        brightnessMin: 0.45,
        brightnessMax: 1.0,
    },
};
