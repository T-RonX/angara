import { deg2rad } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// LonLatCutStrategy — decides the ORIENTATION of the slice plane for the
// longitude/latitude topology, from the traversal axis and the focus point:
//
//   longitude axis : a meridian (constant-longitude) plane — a vertical
//                    cliff; poles to the left/right.
//   latitude axis  : a through-centre plane tilted by the focus latitude;
//                    tilting it sweeps the cut pole-ward (poles top/bottom).
//                    When the focus strolls onto a polar cap the cut snaps
//                    to a vertical meridian so the cap's depth stack shows.
// ----------------------------------------------------------------------
export class LonLatCutStrategy
{
    #traverseAxis;
    #capModel;

    constructor(traverseAxis, capModel)
    {
        this.#traverseAxis = traverseAxis;
        this.#capModel = capModel;
    }

    // True when the latitude-traversal focus has strolled onto a polar cap.
    isPoleCut(focus)
    {
        return this.#traverseAxis === 'latitude'
            && this.#capModel.capRows > 0
            && Math.abs(focus.lat) >= this.#capModel.capBoundaryLatN - 1e-6;
    }

    orient(plane, focus)
    {
        const lonR = deg2rad(focus.lon);
        const latR = deg2rad(focus.lat);

        if (this.#traverseAxis === 'latitude' && !this.isPoleCut(focus))
        {
            plane.normal.set(
                -Math.sin(latR) * Math.cos(lonR),
                Math.cos(latR),
                -Math.sin(latR) * Math.sin(lonR),
            );
        }
        else
        {
            // Longitude axis OR latitude axis parked on a pole: a vertical
            // meridian plane through the poles.
            plane.normal.set(Math.sin(lonR), 0, -Math.cos(lonR));
        }
    }
}
