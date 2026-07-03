import * as THREE from 'three';
import { deg2rad } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// ClipController — owns the single plane that slices the body open in
// resource mode and decides its ORIENTATION from the traversal axis and
// the current focus point. The plane always passes through the body centre
// (so the cliff exposes the full depth stack), except during the open-slice
// transition where it is swept in from off-centre.
//
//   longitude axis : a meridian (constant-longitude) plane — a vertical
//                    cliff; poles to the left/right.
//   latitude axis  : a through-centre plane tilted by the focus latitude;
//                    tilting it sweeps the cut pole-ward (poles top/bottom).
//                    When the focus strolls onto a polar cap the cut snaps
//                    to a vertical meridian so the cap's depth stack shows.
// ----------------------------------------------------------------------
export class ClipController
{
    plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    cutLon = null;
    cutLat = null;

    onCutChanged = null; // called after the plane / caps update (hover invalidation)

    #focus;
    #traverseAxis;
    #capModel;
    #capBuilder = null;

    constructor(focus, traverseAxis, capModel)
    {
        this.#focus = focus;
        this.#traverseAxis = traverseAxis;
        this.#capModel = capModel;
    }

    setCapBuilder(capBuilder)
    {
        this.#capBuilder = capBuilder;
    }

    // True when the latitude-traversal focus has strolled onto a polar cap.
    isPoleCut()
    {
        return this.#traverseAxis === 'latitude'
            && this.#capModel.capRows > 0
            && Math.abs(this.#focus.lat) >= this.#capModel.capBoundaryLatN - 1e-6;
    }

    resetCut()
    {
        this.cutLon = null;
        this.cutLat = null;
    }

    // Re-orient and re-place the plane, then rebuild the caps. `constant` /
    // `slab` are non-default only during the open-slice transition.
    updateCut(constant = 0, slab = false)
    {
        const lonR = deg2rad(this.#focus.lon);
        const latR = deg2rad(this.#focus.lat);

        if (this.#traverseAxis === 'latitude' && !this.isPoleCut())
        {
            this.plane.normal.set(
                -Math.sin(latR) * Math.cos(lonR),
                Math.cos(latR),
                -Math.sin(latR) * Math.sin(lonR),
            );
        }
        else
        {
            // Longitude axis OR latitude axis parked on a pole: a vertical
            // meridian plane through the poles.
            this.plane.normal.set(Math.sin(lonR), 0, -Math.cos(lonR));
        }

        this.plane.constant = constant;
        this.#capBuilder.build(slab);
        this.cutLon = this.#focus.lon;
        this.cutLat = this.#focus.lat;

        if (this.onCutChanged) this.onCutChanged();
    }
}

