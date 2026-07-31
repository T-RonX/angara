// ----------------------------------------------------------------------
// PHYSICAL configuration — "what the solar system IS".
//
// Pure DATA: bodies (geometry, materials, atmosphere), and the light sources
// (stars). No behaviour or scene/rendering knobs live here — those belong
// in behaviour.js. Eventually this exact shape will be delivered by the
// backend, so keep it serialisable (plain numbers / strings / arrays only).
// ----------------------------------------------------------------------
// Channels are elevation (0, -1..1), moisture (1, 0..1), and temperature
// (2, 0..1). Rules in a region are ANDed; regions are ORed. `blend` is the
// smooth distance outside a rule's hard min/max bounds.
const biomeSurface = (
    macroNormalMultiplier,
    microNormalMultiplier,
    microFrequencyMultiplier,
    albedoVariation,
    roughnessBias,
    structure,
) => ({
    macroNormalMultiplier,
    microNormalMultiplier,
    microFrequencyMultiplier,
    albedoVariation,
    roughnessBias,
    structure,
});

const classicBiomes = (colors, [e0, e3, t0, m0, m1], surfaces) =>
{
    const e1 = e0 + 0.14;
    const e2 = e3 * 0.72;
    const rule = (channel, min, max, blend) => ({ channel, min, max, blend });

    return [
        {
            color: colors[0],
            regions: [[rule(0, -1, e0, 0.06)]],
            surface: surfaces[0],
        },
        {
            color: colors[1],
            regions: [[rule(0, e0, e1, 0.1), rule(2, t0, 1, 0.05)]],
            surface: surfaces[1],
        },
        {
            color: colors[2],
            regions: [[
                rule(0, e1, e3, 0.08),
                rule(1, 0, m0, 0.08),
                rule(2, t0, 1, 0.05),
            ]],
            surface: surfaces[2],
        },
        {
            color: colors[3],
            regions: [
                [
                    rule(0, e1, e2, 0.08),
                    rule(1, m0, 1, 0.08),
                    rule(2, t0, 1, 0.05),
                ],
                [
                    rule(0, e2, e3, 0.08),
                    rule(1, m1, 1, 0.08),
                    rule(2, t0, 1, 0.05),
                ],
            ],
            surface: surfaces[3],
        },
        {
            color: colors[4],
            regions: [[
                rule(0, e2, e3, 0.08),
                rule(1, m0, m1, 0.08),
                rule(2, t0, 1, 0.05),
            ]],
            surface: surfaces[4],
        },
        {
            color: colors[5],
            regions: [
                [rule(0, e0, e3, 0.08), rule(2, 0, t0, 0.05)],
                [rule(0, e3, 1, 0.12)],
            ],
            surface: surfaces[5],
        },
    ];
};

// Reusable physical presets keep each body family coherent from its largest
// landforms down to its shader-only surface response.
const terrainPresets = {
    temperate: {
        profile: 'temperate',
        maxDisplacement: 0.045,
        displacementMultiplier: 1,
        continental: {
            frequency: 0.72,
            strength: 0.68,
            octaves: 4,
            lacunarity: 2.03,
            gain: 0.5,
            seaLevel: -0.02,
        },
        mountains: {
            frequency: 2.35,
            strength: 0.34,
            octaves: 4,
            lacunarity: 2.08,
            gain: 0.48,
            warpFrequency: 1.15,
            warpStrength: 0.32,
            maskMin: -0.02,
            maskMax: 0.58,
            sharpness: 2.2,
        },
        detail: {
            frequency: 7.5,
            strength: 0.07,
            octaves: 3,
            lacunarity: 2.15,
            gain: 0.44,
        },
        feature: {
            frequency: 3.2,
            strength: 0.035,
            sharpness: 2.0,
        },
        climate: {
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            moistureFrequency: 1.65,
            temperatureFrequency: 1.2,
            latitudeInfluence: 0.68,
            altitudeCooling: 0.24,
        },
        biomes: classicBiomes(
            [0x173b63, 0xc5ad72, 0x9d7748, 0x647f4c, 0x2f5738, 0xd9dfe2],
            [-0.16, 0.5, 0.3, 0.34, 0.68],
            [
                biomeSurface(0.15, 0.08, 0.55, 0.035, -0.12, { type: 'waves', frequency: 7, strength: 0.08 }),
                biomeSurface(0.45, 0.22, 0.7, 0.09, 0.08, { type: 'dunes', frequency: 9, strength: 0.18 }),
                biomeSurface(0.75, 0.36, 0.85, 0.12, 0.16, { type: 'ridges', frequency: 8, strength: 0.22 }),
                biomeSurface(0.35, 0.2, 0.8, 0.1, 0.04, { type: 'none', frequency: 1, strength: 0 }),
                biomeSurface(0.5, 0.3, 0.9, 0.11, 0.1, { type: 'cracks', frequency: 12, strength: 0.12 }),
                biomeSurface(0.3, 0.16, 0.65, 0.06, -0.18, { type: 'ice', frequency: 8, strength: 0.18 }),
            ],
        ),
        biomeJitter: 0.015,
        biomeColorVariation: 0.025,
        surface: {
            macroFrequency: 6,
            microFrequency: 96,
            albedoVariation: 0.13,
            macroNormalStrength: 0.025,
            microNormalStrength: 0.006,
            roughnessMin: 0.58,
            roughnessMax: 0.94,
            slopeStrength: 0.62,
            cellTintStrength: 0.012,
            cellRoughnessStrength: 0.025,
        },
    },
    barren: {
        profile: 'barren',
        maxDisplacement: 0.06,
        displacementMultiplier: 1,
        continental: {
            frequency: 1.05,
            strength: 0.52,
            octaves: 4,
            lacunarity: 2.1,
            gain: 0.5,
            seaLevel: -0.1,
        },
        mountains: {
            frequency: 3.2,
            strength: 0.28,
            octaves: 4,
            lacunarity: 2.14,
            gain: 0.46,
            warpFrequency: 1.7,
            warpStrength: 0.24,
            maskMin: -0.45,
            maskMax: 0.52,
            sharpness: 2.8,
        },
        detail: {
            frequency: 9,
            strength: 0.085,
            octaves: 3,
            lacunarity: 2.2,
            gain: 0.42,
        },
        feature: {
            frequency: 5.5,
            strength: 0.16,
            sharpness: 5.5,
        },
        climate: {
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            moistureFrequency: 1.8,
            temperatureFrequency: 1.35,
            latitudeInfluence: 0.42,
            altitudeCooling: 0.16,
        },
        biomes: classicBiomes(
            [0x30343b, 0x81786d, 0x94887a, 0x77716a, 0x5c5752, 0xc9c9c7],
            [-0.72, 0.5, 0.3, 0.34, 0.68],
            [
                biomeSurface(0.2, 0.1, 0.55, 0.05, 0.12, { type: 'craters', frequency: 6, strength: 0.3 }),
                biomeSurface(0.65, 0.28, 0.8, 0.1, 0.16, { type: 'craters', frequency: 10, strength: 0.42 }),
                biomeSurface(0.8, 0.34, 0.9, 0.12, 0.2, { type: 'ridges', frequency: 9, strength: 0.3 }),
                biomeSurface(0.45, 0.2, 0.7, 0.08, 0.1, { type: 'none', frequency: 1, strength: 0 }),
                biomeSurface(0.55, 0.26, 0.85, 0.1, 0.14, { type: 'cracks', frequency: 14, strength: 0.16 }),
                biomeSurface(0.38, 0.15, 0.65, 0.06, 0.04, { type: 'craters', frequency: 5, strength: 0.18 }),
            ],
        ),
        biomeJitter: 0.015,
        biomeColorVariation: 0.025,
        surface: {
            macroFrequency: 9,
            microFrequency: 128,
            albedoVariation: 0.16,
            macroNormalStrength: 0.032,
            microNormalStrength: 0.008,
            roughnessMin: 0.72,
            roughnessMax: 0.98,
            slopeStrength: 0.74,
            cellTintStrength: 0.01,
            cellRoughnessStrength: 0.02,
        },
    },
    arid: {
        profile: 'arid',
        maxDisplacement: 0.065,
        displacementMultiplier: 1,
        continental: {
            frequency: 0.9,
            strength: 0.58,
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            seaLevel: -0.08,
        },
        mountains: {
            frequency: 2.8,
            strength: 0.38,
            octaves: 4,
            lacunarity: 2.12,
            gain: 0.47,
            warpFrequency: 1.25,
            warpStrength: 0.38,
            maskMin: -0.3,
            maskMax: 0.62,
            sharpness: 2.45,
        },
        detail: {
            frequency: 8,
            strength: 0.075,
            octaves: 3,
            lacunarity: 2.18,
            gain: 0.43,
        },
        feature: {
            frequency: 13,
            strength: 0.075,
            sharpness: 2.4,
        },
        climate: {
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            moistureFrequency: 2.1,
            temperatureFrequency: 1.1,
            latitudeInfluence: 0.55,
            altitudeCooling: 0.18,
        },
        biomes: classicBiomes(
            [0x332b26, 0x9b775e, 0xa56e42, 0x786047, 0x4c4538, 0xc5ad8b],
            [-0.68, 0.5, 0.3, 0.34, 0.68],
            [
                biomeSurface(0.2, 0.1, 0.5, 0.04, 0.08, { type: 'none', frequency: 1, strength: 0 }),
                biomeSurface(0.42, 0.18, 0.65, 0.1, 0.06, { type: 'dunes', frequency: 12, strength: 0.3 }),
                biomeSurface(0.76, 0.3, 0.8, 0.13, 0.16, { type: 'ridges', frequency: 7, strength: 0.32 }),
                biomeSurface(0.5, 0.22, 0.75, 0.09, 0.11, { type: 'strata', frequency: 10, strength: 0.2 }),
                biomeSurface(0.58, 0.26, 0.85, 0.1, 0.13, { type: 'cracks', frequency: 15, strength: 0.18 }),
                biomeSurface(0.36, 0.16, 0.6, 0.06, 0.03, { type: 'strata', frequency: 6, strength: 0.12 }),
            ],
        ),
        biomeJitter: 0.015,
        biomeColorVariation: 0.025,
        surface: {
            macroFrequency: 7,
            microFrequency: 112,
            albedoVariation: 0.18,
            macroNormalStrength: 0.028,
            microNormalStrength: 0.007,
            roughnessMin: 0.66,
            roughnessMax: 0.97,
            slopeStrength: 0.7,
            cellTintStrength: 0.012,
            cellRoughnessStrength: 0.025,
        },
    },
    glacial: {
        profile: 'glacial',
        maxDisplacement: 0.032,
        displacementMultiplier: 1,
        continental: {
            frequency: 0.62,
            strength: 0.62,
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            seaLevel: -0.02,
        },
        mountains: {
            frequency: 2.05,
            strength: 0.26,
            octaves: 4,
            lacunarity: 2.08,
            gain: 0.46,
            warpFrequency: 0.9,
            warpStrength: 0.28,
            maskMin: -0.12,
            maskMax: 0.6,
            sharpness: 2.0,
        },
        detail: {
            frequency: 6.5,
            strength: 0.055,
            octaves: 3,
            lacunarity: 2.12,
            gain: 0.42,
        },
        feature: {
            frequency: 8.5,
            strength: 0.1,
            sharpness: 4.2,
        },
        climate: {
            octaves: 4,
            lacunarity: 2,
            gain: 0.5,
            moistureFrequency: 1.4,
            temperatureFrequency: 0.9,
            latitudeInfluence: 0.76,
            altitudeCooling: 0.28,
        },
        biomes: classicBiomes(
            [0x244769, 0xaacde2, 0xc6e0ea, 0x91b5c3, 0x678d9f, 0xf0f4f5],
            [-0.08, 0.28, 0.3, 0.34, 0.68],
            [
                biomeSurface(0.12, 0.06, 0.5, 0.03, -0.2, { type: 'waves', frequency: 6, strength: 0.06 }),
                biomeSurface(0.36, 0.16, 0.65, 0.07, -0.08, { type: 'ice', frequency: 9, strength: 0.28 }),
                biomeSurface(0.5, 0.22, 0.8, 0.09, -0.03, { type: 'ice', frequency: 13, strength: 0.34 }),
                biomeSurface(0.42, 0.2, 0.75, 0.08, 0.02, { type: 'cracks', frequency: 10, strength: 0.16 }),
                biomeSurface(0.48, 0.22, 0.85, 0.09, 0.06, { type: 'ridges', frequency: 8, strength: 0.18 }),
                biomeSurface(0.24, 0.12, 0.6, 0.05, -0.14, { type: 'ice', frequency: 6, strength: 0.16 }),
            ],
        ),
        biomeJitter: 0.015,
        biomeColorVariation: 0.02,
        surface: {
            macroFrequency: 5,
            microFrequency: 104,
            albedoVariation: 0.11,
            macroNormalStrength: 0.02,
            microNormalStrength: 0.005,
            roughnessMin: 0.3,
            roughnessMax: 0.88,
            slopeStrength: 0.48,
            cellTintStrength: 0.008,
            cellRoughnessStrength: 0.018,
        },
    },
};

const terrain = (profileName, overrides = {}) =>
{
    const preset = terrainPresets[profileName];

    if (!preset)
    {
        throw new Error(`[physical] Unknown terrain preset '${profileName}'`);
    }

    return {
        ...structuredClone(preset),
        textureWidth: 1024,
        ...overrides,
        continental: {
            ...preset.continental,
            ...(overrides.continental ?? {}),
        },
        mountains: {
            ...preset.mountains,
            ...(overrides.mountains ?? {}),
        },
        detail: {
            ...preset.detail,
            ...(overrides.detail ?? {}),
        },
        feature: {
            ...preset.feature,
            ...(overrides.feature ?? {}),
        },
        climate: {
            ...preset.climate,
            ...(overrides.climate ?? {}),
        },
        surface: {
            ...preset.surface,
            ...(overrides.surface ?? {}),
        },
        biomes: structuredClone(overrides.biomes ?? preset.biomes),
    };
};

const physicalTemplate = {
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
        hexFrequency: 32,
        maxDepth: 5,              // number of crust layers (any reasonable number)
        shape: {
            type: 'sphere',
            axisScale: [1.0, 0.82, 1.15],
        },
        terrain: terrain(
            'temperate',
            {
                maxDisplacement: 0.04,
                displacementMultiplier: 0.9,
            },
        ),
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

        rings: {
            show: true,
            innerRadius: 1.20,
            outerRadius: 2.45,
            inclinationDeg: 0,
            ascendingNodeDeg: 0,
            textureWidth: 2048,
            ambient: 0.16,
            diffuse: 0.82,
            forwardScattering: 0.42,
            backScattering: 0.16,
            bands: [
                {
                    innerRadius: 1.20,
                    outerRadius: 1.38,
                    color: 0x8f887c,
                    opacity: 0.28,
                    density: 0.48,
                    edgeSoftness: 0.018,
                    variationScale: 170,
                    variationStrength: 0.34,
                },
                {
                    innerRadius: 1.42,
                    outerRadius: 1.63,
                    color: 0xb3aa98,
                    opacity: 0.58,
                    density: 0.68,
                    edgeSoftness: 0.016,
                    variationScale: 230,
                    variationStrength: 0.26,
                },
                {
                    innerRadius: 1.66,
                    outerRadius: 1.98,
                    color: 0xc8bda6,
                    opacity: 0.88,
                    density: 0.92,
                    edgeSoftness: 0.014,
                    variationScale: 310,
                    variationStrength: 0.20,
                },
                {
                    innerRadius: 2.07,
                    outerRadius: 2.29,
                    color: 0xb8ac98,
                    opacity: 0.72,
                    density: 0.78,
                    edgeSoftness: 0.012,
                    variationScale: 280,
                    variationStrength: 0.24,
                },
                {
                    innerRadius: 2.36,
                    outerRadius: 2.41,
                    color: 0x968d81,
                    opacity: 0.34,
                    density: 0.42,
                    edgeSoftness: 0.010,
                    variationScale: 360,
                    variationStrength: 0.32,
                },
            ],
        },

        companions: [
            {
                id: 'moon-1',
                name: 'Moon',
                hexFrequency: 16,
                maxDepth: 4,
                shape: {
                    type: 'noise',
                },
                terrain: terrain(
                    'barren',
                    {
                        maxDisplacement: 0.055,
                        mountains: {
                            strength: 0.32,
                        },
                    },
                ),
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
                },
                terrain: terrain(
                    'arid',
                    {
                        maxDisplacement: 0.07,
                        displacementMultiplier: 1.15,
                        mountains: {
                            frequency: 3.15,
                            strength: 0.42,
                        },
                    },
                ),
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
                },
                terrain: terrain(
                    'glacial',
                    {
                        maxDisplacement: 0.028,
                    },
                ),
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

function applySeeds(body, seedNode)
{
    if (!seedNode || seedNode.id !== body.id)
    {
        throw new Error(`[physical] Missing seed payload for body '${body.id}'`);
    }

    body.seed = seedNode.seed;

    const childSeeds = new Map(
        (seedNode.companions ?? []).map(child => [child.id, child]),
    );

    for (const companion of body.companions ?? [])
    {
        applySeeds(companion, childSeeds.get(companion.id));
    }
}

export function createPhysical(seedPayload)
{
    const physical = structuredClone(physicalTemplate);
    applySeeds(physical.body, seedPayload);

    return physical;
}
