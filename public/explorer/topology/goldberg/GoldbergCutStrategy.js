import { deg2rad } from '../../core/MathUtils.js';

// ----------------------------------------------------------------------
// GoldbergCutStrategy — orients the slice plane for the hexsphere. There are
// no poles and no special cases: the cut is always a through-centre MERIDIAN
// plane at the focus longitude, i.e. a vertical great-circle wall that
// contains the focus radial (so the focus cell always sits on the cliff and
// exposes its full depth stack). The crust camera looks at it edge-on.
//
// This is exactly the generic tangent-plane cut the plan calls for: the plane
// normal is perpendicular to the focus radial, and moving latitude slides the
// focus ALONG the same wall (the camera pans) while moving longitude rebuilds
// it — no meridian/tilted/pole branching, because the hexsphere has no poles.
// ----------------------------------------------------------------------
export class GoldbergCutStrategy
{
    orient(plane, focus)
    {
        // Pole-free frame: the traversal maintains nCut ⟂ dir, so the plane
        // through the centre with normal nCut always contains the focus radial.
        if (focus.nCut && focus.nCut.lengthSq() > 0.5)
        {
            plane.normal.copy(focus.nCut);

            return;
        }

        // Fallback before the frame is initialised: meridian at focus lon.
        const lonR = deg2rad(focus.lon);

        plane.normal.set(Math.sin(lonR), 0, -Math.cos(lonR));
    }
}
