// ----------------------------------------------------------------------
// BEHAVIOUR configuration — "how the explorer FEELS to use".
//
// Pure DATA describing camera framing, input response, traversal style and
// the mode-change animation. Kept separate from the physical body data so
// the two can be tuned (and eventually sourced) independently.
// ----------------------------------------------------------------------
export const behaviour = {
    // Resource-mode camera framing.
    camera: {
        // Angle (radians) above the meridian plane — higher looks down at
        // the surface more, revealing terrain above the cut.
        crustTilt:       0.40,
        // Lifts the look-at target along the surface normal (fraction of the
        // crust thickness) so the cliff sits lower on screen.
        crustHeightBias: 0.2,
        // Default zoom as a multiple of the crust thickness, clamped.
        crustZoom:    2.6,
        crustZoomMin: 1.2,
        crustZoomMax: 7.0,
    },

    // Pointer / scroll response.
    input: {
        // Drag-to-stroll sensitivity. 1 = cursor 1:1 with the surface.
        dragSensitivity: 1,
        // Positive values keep the current drag sense; -1 flips that axis.
        dragDirectionX: 1,
        dragDirectionY: 1,
        // Right-drag roll speed multiplier in the hexsphere traversal.
        rollSensitivity: 3,
        // Wheel zoom factors for scrolling in/out of resource mode.
        wheelZoomInFactor: 0.9,
        wheelZoomOutFactor: 1.1,
        // Per-frame fraction of the remaining distance eased toward the
        // snapped target cell. Larger = snappier, smaller = more gliding.
        focusSnapEase:   0.1,
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
        enabled: true,
        impostorBelowAngular: 0.02,   // ~1.1° angular radius
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
        updateHz: 30,
    },

    // Hexsphere resource-mode staircase slicing.
    slice: {
        // Duration (ms) of the temporal fade when the advancing cut reveals a
        // new row of whole cells (or hides a leaving one). 0 disables the fade.
        cellFadeMs: 200,

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

        // Resource-mode horizon (occlusion) culling: hide slice buckets that
        // curve over the planet's own horizon relative to the camera. Purely a
        // per-frame visibility toggle — no geometry rebuild.
        horizonCull: {
            enabled: true,
            // Angular slack (degrees) added to each bucket's own extent so a
            // partially-visible bucket is never dropped (surface-preserving).
            marginDeg: 16,
        },
    },
};
