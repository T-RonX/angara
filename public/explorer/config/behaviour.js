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
        focusSnapEase:   0.22,
    },

    // Which way you "stroll" through the body and where the poles sit:
    //   'longitude' : meridian cut through the poles; travel around the
    //                 equator; poles to your LEFT and RIGHT.
    //   'latitude'  : through-centre cut tilted by the focus latitude;
    //                 travel toward the poles; they sit ABOVE and BELOW.
    traversal: {
        resourceTraverseAxis: 'latitude',
    },

    // Smooth fly-in / fly-out when entering or leaving resource mode.
    transition: {
        modeTransitionMs: 700,
    },

    // Hexsphere resource-mode staircase slicing.
    slice: {
        // Duration (ms) of the temporal fade when the advancing cut reveals a
        // new row of whole cells (or hides a leaving one). 0 disables the fade.
        cellFadeMs: 260,
    },
};
