// ----------------------------------------------------------------------
// CellTopology — the ABSTRACTION that decides how the body is divided into
// cells and everything that flows from that choice. The rest of the app
// (BodyExplorer + subsystems) depends only on this contract, never on a
// concrete grid, so a single config flag can swap the whole scheme.
//
// A concrete topology (LonLatTopology, GoldbergTopology, …) must provide:
//
//   grid                       — { cells, cellsByDepth, atmosphereCells, … }
//                                where every crust/atmosphere cell is a
//                                uniform N-gon PRISM record:
//                                { kind, depth, lon, lat, outerRing[N],
//                                  innerRing[N], corners = outer++inner, … }
//                                (plus any topology-private fields).
//
//   createSurfacePicker()      — { pick(raycaster) → cell | null } for view
//                                mode.
//
//   cutStrategy                — { orient(plane, focus) } that sets the clip
//                                plane's normal for the current focus.
//
//   createBroadPhase()         — { prepare(plane, focus, slab), accept(cell) }
//                                narrowing which cells the cut can cross.
//
//   traversal                  — how the focus point moves in resource mode:
//                                { enterFocus(focus, cell), snapTargets(focus),
//                                  onArrow(focus, key), onDrag(focus, dx, dy,
//                                  dpp), cutMoved(lonChanged, latChanged) }.
//
//   buildGridLines()           — a THREE.Object3D of faint surface grid lines
//                                (may be empty), hidden by default.
//
//   cellTypeLabel(cell)        — a short human label for the HUD read-out.
//
// The focus point is always expressed as { lon, lat } (degrees) so the
// crust camera and the focus easing stay topology-agnostic; a topology maps
// that continuous coordinate onto its own discrete cells inside `traversal`
// and `createSurfacePicker`.
// ----------------------------------------------------------------------
export class CellTopology
{
    get grid()          { throw new Error('CellTopology.grid not implemented'); }
    get cutStrategy()   { throw new Error('CellTopology.cutStrategy not implemented'); }
    get traversal()     { throw new Error('CellTopology.traversal not implemented'); }

    createSurfacePicker() { throw new Error('CellTopology.createSurfacePicker not implemented'); }
    createBroadPhase()    { throw new Error('CellTopology.createBroadPhase not implemented'); }
    buildGridLines()      { throw new Error('CellTopology.buildGridLines not implemented'); }

    cellTypeLabel(cell)
    {
        if (cell.isAtmosphere) return 'atmosphere';

        return cell.depth === 0 ? 'surface' : 'crust';
    }
}
