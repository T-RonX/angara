// ----------------------------------------------------------------------
// PHYSICAL configuration — "what the solar system IS".
//
// Pure DATA: bodies (geometry, materials, atmosphere), and the light sources
// (stars). No behaviour or scene/rendering knobs live here — those belong
// in behaviour.js. Eventually this exact shape will be delivered by the
// backend, so keep it serialisable (plain numbers / strings / arrays only).
// ----------------------------------------------------------------------
export const physical = {
    // Global cell size: world units of body radius per unit of `hexFrequency`.
    // Every body derives its `radius = hexFrequency × cellSize`, so all bodies
    // share the same physical cell dimensions regardless of size. Anchored to
    // the primary's historical 500 / 128 so it keeps radius 500 at f = 128.
    cellSize: 4,

    body: {
        id:       'primary',      // stable identifier (UI + future backend)
        name:     'Angara',       // display name in the body-picker UI
        // Hexsphere subdivision frequency (icosahedron edge divisions). The
        // surface has 10·f²+2 cells; keep modest (e.g. 12–24). The body's
        // `radius` is derived from this via the global `cellSize`.
        hexFrequency: 64,
        maxDepth: 5,              // number of crust layers (any reasonable number)
        shape: {
            type: 'sphere',        // 'sphere' | 'noise'
            seed: 1337,           // integer; same seed ⇒ identical body
            octaves: 2,           // fBm octave count
            baseFrequency: 1.4,   // noise frequency of the first octave
            lacunarity: 2.0,      // frequency multiplier per octave
            gain: 0.55,           // amplitude multiplier per octave
            amplitude: 0.35,      // overall displacement strength (fraction of radius)
            maxDisplacement: 0.11,// hard clamp on |displacement| (fraction) — keeps it star-shaped
            axisScale: [1.0, 0.82, 1.15], // optional elongation (still star-shaped)
        },
        axialTiltDeg:      23.4,  // obliquity (degrees); 0 = north pole aligned with world Y
        rotationPeriodSec: 1360,   // one full prograde spin in real-time seconds; 0 = stationary

        // Per-layer thickness (length must be >= maxDepth; entries past
        // maxDepth are ignored). Set to null to auto-generate a sensible
        // monotonically-thickening default.
        layerThicknesses: null,
        // Auto-thickness knobs (only used when `layerThicknesses === null`):
        //   thickness(d) = layerThicknessBase + d * layerThicknessGrowth
        layerThicknessBase:   1,
        layerThicknessGrowth: 1.5,

        // The "core" sphere shown beneath the deepest crust layer.
        coreColor: 0xc9743a,
        // One colour per depth layer (ex ind0 = surface … deeper). Padded
        // toward `coreColor` automatically when shorter than maxDepth.
        depthColors: [0x6f8b57, 0x8a6d3b, 0x2a2f3a],

        // Flat skirt ring that fills the resource-mode seam between the round
        // core cut-disc and the jagged bottom of the deepest crust cells.
        // `color: null` = auto-derive a very dark tone from this body's colours.
        coreSkirt: { color: null, stretch: 0.2 },

        // RESERVED for future texturing of the VISIBLE layer faces. When
        // these become arrays (one entry per visible layer) the material
        // factory will skin the crust faces with them. Null = the flat
        // `depthColors` look used today.
        layerTextures:    null,   // future: [url | null, …] per visible layer
        layerNormalMaps:  null,   // future: [url | null, …] per visible layer

        gridColor:  0x0a0e16,
        cellGap:    0.0,          // gap between cells (fraction); 0 = touching

        // ------------------------------------------------------------------
        // This body's atmosphere — an analytical single-scattering Rayleigh +
        // Mie shell. Every knob is exposed so the look can be retuned per body.
        // Each body owns its OWN block; there is no shared/global atmosphere.
        // ------------------------------------------------------------------
        atmosphere: {
            show:        true,
            // Whether the shell remains visible while the explorer is in
            // resource mode. `selectable` still governs pick/hover interaction.
            showInResourceMode: true,
            // Whether the atmosphere is a selectable cell shell (hover / pick /
            // highlight in resource mode). The visible haze is the shader either
            // way; this only governs interactivity.
            selectable:  true,
            // Thickness as a fraction of this body's `radius`.
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
        },

        companions: [
            {
                id: 'moon-1',
                name: 'Moon',
                hexFrequency: 16,
                maxDepth: 4,
                shape: {
                    type: 'noise',
                    seed: 4242,
                    octaves: 2,
                    baseFrequency: 1.6,
                    lacunarity: 2.0,
                    gain: 0.55,
                    amplitude: 0.35,
                    maxDisplacement: 0.14
                },
                axialTiltDeg:      6.7,  // obliquity (degrees); 0 = north pole aligned with world Y
                rotationPeriodSec: 1600,  // one full prograde spin in real-time seconds; 0 = stationary
                layerThicknesses: null,
                layerThicknessBase: 1,
                layerThicknessGrowth: 1.5,
                coreColor: 0x8a8f98,
                depthColors: [0x9aa3ad, 0x6b7178],
                coreSkirt: { color: null, stretch: 0.4 },
                gridColor: 0x0a0e16,
                cellGap: 0.0,

                // The moon's OWN atmosphere — a thin, cool haze that stays visible
                // without looking like a thick Earth-like blanket.
                atmosphere: {
                    show:        false,
                },
                orbit: {
                    // Scaled up ~5.7× to reduce parallax. At current zoom, far bodies
                    // should barely shift against the background as camera pans.
                    semiMajorAxis: 40000,
                    eccentricity: 0.11,
                    periodSec: 1800,
                    phaseDeg: 115,
                    inclinationDeg: 18,
                    ascendingNodeDeg: 32
                },
            },
            {
                id: 'satellite-1',
                name: 'Ferros',
                hexFrequency: 20,
                maxDepth: 3,
                shape: {
                    type: 'noise',
                    seed: 9876,
                    octaves: 3,
                    baseFrequency: 2.1,
                    lacunarity: 2.2,
                    gain: 0.48,
                    amplitude: 0.40,
                    maxDisplacement: 0.16
                },
                axialTiltDeg:      57,  // obliquity (degrees); 0 = north pole aligned with world Y
                rotationPeriodSec: 1145,  // one full prograde spin in real-time seconds; 0 = stationary
                layerThicknesses: null,
                layerThicknessBase: 1,
                layerThicknessGrowth: 1.3,
                coreColor: 0x7a6b4a,
                depthColors: [0xa0826d, 0x6b5a47, 0x4a3f2f],
                coreSkirt: { color: null, stretch: 0.4 },
                gridColor: 0x0a0e16,
                cellGap: 0.0,

                atmosphere: {
                    show: false,
                },

                orbit: {
                    // Scaled up ~5× to reduce parallax. Close companion should show
                    // noticeable but not excessive parallax when camera moves.
                    semiMajorAxis: 22500,
                    eccentricity: 0.05,
                    periodSec: 1200,
                    phaseDeg: 25,
                    inclinationDeg: 8,
                    ascendingNodeDeg: 78
                },
            },
            {
                id: 'satellite-2',
                name: 'Glacios',
                hexFrequency: 10,
                maxDepth: 3,
                shape: {
                    type: 'sphere',
                    seed: 1111,
                    octaves: 1,
                    baseFrequency: 0.5,
                    lacunarity: 1.0,
                    gain: 0.0,
                    amplitude: 0.0,
                    maxDisplacement: 0.0
                },
                axialTiltDeg:      28,   // obliquity (degrees); 0 = north pole aligned with world Y
                rotationPeriodSec: 1240,  // one full prograde spin in real-time seconds; 0 = stationary
                layerThicknesses: null,
                layerThicknessBase: 1.2,
                layerThicknessGrowth: 1.4,
                coreColor: 0x4a5f8a,
                depthColors: [0xe8f0ff, 0xc5deff, 0x9abeff],
                coreSkirt: { color: null, stretch: 0.4 },
                gridColor: 0x0a0e16,
                cellGap: 0.0,

                atmosphere: {
                    show:        true,
                    showInResourceMode: true,
                    selectable:  true,
                    thickness:   0.038,
                    sunIntensity: 0.80,
                    opacity:     0.85,
                    baseColor:      [0.88, 0.93, 1.2],
                    rayleighCoeff:  [0.24, 0.26, 0.30],
                    rayleighScaleFrac: 0.32,
                    mieScaleFrac:      0.14,
                    mieCoeff:    0.25,
                    mieG:        0.68,
                    viewSteps:   12,
                    lightSteps:  6,
                },

                orbit: {
                    // Scaled up 5× to reduce parallax. Very distant body should have
                    // minimal apparent motion against the background.
                    semiMajorAxis: 45000,
                    eccentricity: 0.32,
                    periodSec: 3000,
                    phaseDeg: 210,
                    inclinationDeg: 22,
                    ascendingNodeDeg: 145
                },
            },
        ],
    },

    // Stars remain physical: they are actual light sources with positions,
    // intensities and visual properties — not rendering behaviour.
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
};
