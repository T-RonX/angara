// ----------------------------------------------------------------------
// BEHAVIOUR configuration — "how the explorer FEELS to use".
//
// This is the SINGLE tuning file: camera framing, input response, traversal
// style, mode-change animation, scene rendering settings (background,
// lighting fill, starfield), and graphics optimisations. Kept separate from
// the physical body / star data so the two can be tuned (and eventually
// sourced) independently.
// ----------------------------------------------------------------------
export const behaviour = {
    // Scene-level rendering settings.
    scene: {
        background: 0x05070d,
        fov: 50,
        near: 1,
        far: 200000,
        antialias: true,
        maxPixelRatio: 1.5,
    },

    // Resource-mode camera framing.
    camera: {
        crustTilt:       0.50,
        crustHeightBias: 0.2,
        crustZoom:    1.0,
        crustZoomMin: 0.5,
        crustZoomMax: 2.5,
        zoomBaseline:           50,
        zoomReferenceThickness: 42,
        zoomExponent:           0.5,
        // Orbit controls damping.
        dampingFactor: 0.08,
        // View-mode distance range as multiples of body radius.
        minDistanceFactor: 1.15,
        maxDistanceFactor: 20,
    },

    // Pointer / scroll response.
    input: {
        dragSensitivity: 1,
        dragDirectionX: 1,
        dragDirectionY: 1,
        rollSensitivity: 3,
        wheelZoomInFactor: 0.9,
        wheelZoomOutFactor: 1.1,
        focusSnapEase:   0.1,
        // Click vs drag threshold (px).
        clickSlopPx: 4,
    },

    // Body generation strategy.
    generation: {
        // Offload the heavy Goldberg generation (geodesic + dual + surface
        // geometry) to a Web Worker so the main thread stays responsive and a
        // loading overlay can render while a high-hexFrequency body builds.
        // false = synchronous (blocking) generation on the main thread.
        useWorker: true,
    },

    // Distance level-of-detail for the bodies. The ACTIVE body is always full
    // detail (it can enter resource mode); a companion that shrinks below
    // `impostorBelowAngular` (its radius/distance from the camera, in radians)
    // is swapped for a cheap low-poly impostor sphere — at that apparent size
    // the per-cell detail and the shape displacement are sub-pixel anyway.
    lod: {
        enabled: false,
        impostorBelowAngular: 0.008,  // ~0.46° angular radius
        hysteresis: 1.35,             // must grow 35% past the threshold to go back to full
        impostorSegments: 24,
    },

    // Smooth fly-in / fly-out when entering or leaving resource mode.
    transition: {
        modeTransitionMs: 700,
    },

    // Atmosphere GRAPHICS optimisation (not physical data — shared by all bodies).
    atmosphere: {
        // Cap the scattering raymarch to this many recomputes per second. The
        // pass renders into a cached texture that is re-composited every frame,
        // so the expensive integral is decoupled from the display frame rate.
        // The cache is view-dependent, so it lags slightly while the camera
        // moves. 0 = recompute every frame (no throttling).
        updateHz: 60,
        // Render target resolution scale (0.25–1.0). Lower = cheaper raymarch but
        // grainier haze. The downsampled texture is upsampled to full screen during
        // composite (bilinear filtering). 1.0 = full resolution (default).
        fidelity: 0.25,
    },

    // Hexsphere resource-mode staircase slicing.
    slice: {        // Duration (ms) of the temporal fade when the advancing cut reveals a
        // new row of whole cells (or hides a leaving one). 0 disables the fade.
        cellFadeMs: 0,

        // Interior-cull band that keeps resource mode fast at high hexFrequency.
        // The deeper crust layers (depth >= 1) are only ever visible AT the cut
        // face (the cliff wall); their interior cells are occluded by the wall,
        // the surface skin and their neighbours. So only cells within this many
        // SURFACE-CELL DIAMETERS of the cut plane are built for depth >= 1 (the
        // surface skin, depth 0, is always kept whole so the terrain is never
        // holed). Larger = a thicker, safer wall (no peek-through) but more
        // geometry; smaller = leaner. Set to 0 to disable (keep the whole
        // hemisphere at every depth — the original, slower behaviour).
        wallBandCells: 4,

        // Cap on slice rebuild frequency (ms) while actively dragging the cut plane.
        // The plane orientation updates every frame regardless, but the expensive
        // geometry rebuild is throttled. 0 = rebuild every frame (unlimited);
        // 55 = ~18 rebuilds/sec (default). Deferred rebuilds are flushed when
        // motion stops, so the geometry never gets stuck stale.
        rebuildIntervalMs: 16.6667,

        // Resource-mode horizon (occlusion) culling: hide slice buckets that
        // curve over the body's own horizon relative to the camera. Purely a
        // per-frame visibility toggle — no geometry rebuild.
        horizonCull: {
            enabled: true,
            // Angular slack (degrees) added to each bucket's own extent so a
            // partially-visible bucket is never dropped (surface-preserving).
            marginDeg: 16,
        },
    },

    // ------------------------------------------------------------------
    // Sky-wide fill-light constants and the background star field.
    // Decoupled from the physical star (sun) data so the night-side floor
    // and particle density can be tuned without touching the light sources.
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

    // Developer diagnostics (off in normal play).
    debug: {
        profileSlice: false,
        profileEvery: 30,
    },

    // Highlight overlay colours / offsets (HighlightMeshFactory defaults).
    highlights: {
        hoverColor:                  0xfff2a0,
        hoverOpacity:                0.35,
        hoverEdgeColor:              0xffe66b,
        selectionColor:              0x6fb0ff,
        selectionOpacity:            0.42,
        selectionEdgeColor:          0x9fd0ff,
        resourceColor:               0x6fb0ff,
        resourceOpacity:             0.5,
        resourceEdgeColor:           0x9fd0ff,
        polygonOffsetFactor:        -2,
        polygonOffsetUnits:         -2,
        resourcePolygonOffsetFactor:-3,
        resourcePolygonOffsetUnits: -3,
    },

    // Material defaults injected into LayerMaterialFactory.
    materials: {
        roughness: 0.95,
        metalness: 0.0,
        emissiveScale: 0.06,
        coreRoughness: 1,
        coreCapOffsetFactor: -1,
        coreCapOffsetUnits: -1,
    },
};
