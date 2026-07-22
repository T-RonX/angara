# Body Explorer Architecture

## Scope

This directory is a plain-JavaScript Three.js application served directly from `public/`. It has no build step. Keep modules small, constructor-injected, disposable, and easy to map to TypeScript later.

Hexsphere is the permanent and only cell topology. Do not add topology switches, fake abstract bases, lon/lat fallbacks, polar-cap branches, or type-condition dispatch for unsupported shapes.

## Architecture principles

The architecture must strictly follow the SOLID principles. Dependency injection and single responsibility are mandatory design requirements. Every module should have one clear responsibility, depend on explicit collaborators, and avoid hidden global state or cross-cutting coupling.

The main config files are the key runtime drivers and should remain the authoritative input surface for behavior:

- `config/physical.js` owns body, shape, layers, materials, atmosphere, orbit, rotation, and star definitions.
- `config/behaviour.js` owns camera, input, traversal, transitions, slicing, HUD, lighting fill, atmosphere rendering, and debug behavior.

New behavior should usually be introduced first in these config files, then consumed through injected collaborators and validated before runtime use.

## Configuration contract

There are exactly two runtime data files:

- `config/physical.js`: serializable solar-system input only. It owns `cellSize`, `body`, recursive companions, body shape/layers/material identity/atmosphere/orbit/rotation, and physical star definitions.
- `config/behaviour.js`: the single tuning surface for scene, camera, input, transitions, generation, LOD, lighting fill, materials, highlights, atmosphere rendering, slicing, starfield, HUD cadence, and debug behavior.

`config/ConfigValidator.js` validates both trees before BVH installation or GPU/worker allocation. Add new required values to validation and consume validated values directly instead of scattering fallback defaults.

Use `body`, never `planet`, for the generic celestial-body record.

## Composition and dependency direction

```text
index.js
  -> BodyExplorer (public facade)
     -> application/ExplorerApplication
        -> shared world/render/HUD/input systems
        -> application/ActiveBodyController
           -> application/BodyInteractionSessionFactory
              -> application/BodyInteractionSession
```

- `index.js` is the composition root.
- `BodyExplorer` exposes only `init()`, `start()`, and `dispose()`.
- `ExplorerApplication` owns shared application lifecycle and frame ordering.
- A `BodyInteractionSession` owns all active-body picking, highlights, crust camera, focus, transition, zoom, and selection collaborators.
- Switching bodies disposes the old session and creates a new one. Shared DOM input and HUD listeners bind once.
- Leaf modules must not import runtime config or application controllers.
- Prefer constructor injection. Do not introduce service locators or a global event bus.
- A strategy/factory is justified only by a real variation point, lifecycle boundary, or separately coherent algorithm.

## Module ownership

- `application/`: application orchestration and active-body session lifecycle.
- `atmosphere/`: per-body scattering shell plus visibility, occluder, and render scheduling.
- `config/`: physical input, behavior tuning, and startup validation.
- `core/`: Three.js scene plumbing, BVH installation, and shared math.
- `geometry/`: generic N-gon prism geometry and cached typed arrays.
- `hud/`: strict DOM contract, readouts, body/orbit editors, sliders, and loading state.
- `input/`: the only raw DOM input listener owner.
- `lighting/`, `star/`, `sky/`, `texture/`: lighting and procedural sky visuals.
- `material/`: layer/core material creation and texture ownership.
- `mode/`, `transition/`, `selection/`: mode state, interpolation, and selection policy.
- `model/`: body/layer/orbit/rotation/shape domain models.
- `navigation/`: Goldberg focus traversal and crust camera.
- `picking/`: surface/cliff raycasts, hover scheduling, and overlays.
- `render/`: RAF/resize lifecycle.
- `slicing/`: clip-plane coordination.
- `topology/GoldbergTopology.js`: direct hexsphere assembly.
- `topology/goldberg/slicing/`: resource slice algorithms and render ownership.
- `worker/`: Three-free body generation and worker client.
- `world/`: body meshes/registry/orbit/rotation/LOD/zoom.

## Required runtime behavior

- Recursive bodies have independent orbit, axial tilt, spin, atmosphere, shape, and layer data.
- Shape noise is deterministic for the same radius/seed and remains radially single-valued.
- Sphere view picking is analytic; displaced-body view picking uses the BVH surface mesh.
- Navigation is pole-free: horizontal left-drag pans along the wall, vertical left-drag advances the cut, right-drag rolls, and arrows mirror pan/advance.
- Resource clicks select a cell and update Goldberg focus targets so the camera glides to it.
- Mode transitions sweep the cut from max shape radius to the body center; mid-flight toggles reverse smoothly and input remains locked.
- The atmosphere is a selectable outer layer when configured. Its pick shell is invisible; only highlight wireframe is visible.
- Multiple suns independently drive direct lighting, visuals, flare/occlusion, atmosphere scattering, and generated HUD controls.
- Night fill is independent from direct sun intensity.
- Atmosphere scattering is rendered into a throttled cache and additively composited after the main scene.

## Frame order

Do not reorder the frame pipeline:

1. Update orbits and rotations.
2. Update world matrices and active world clip plane.
3. Update transition/view/resource camera.
4. Update LOD.
5. Tick slice fades.
6. Anchor sky to camera.
7. Update hover when transition is idle.
8. Update compass.
9. Update star occlusion and star visuals.
10. Update atmosphere caches.
11. Render main scene.
12. Composite atmosphere.
13. Update render statistics.

This order ensures camera, clipping, and picking see current body transforms.

## Slice performance invariants

`topology/goldberg/CellSliceBuilder.js` is an orchestrator. Its focused collaborators own membership, persistent slice meshes, transient mesh assembly, fades, atmosphere picking, core rendering, and profiling.

Never regress these rules:

- Membership is decided once per surface column; a rendered deep column is a contiguous stack.
- Surface membership scans use typed corner and centroid coordinates prepared on first resource entry.
- Depth 0 covers the kept hemisphere; deeper cells exist only in the configured wall band.
- The depth-0 atlas remains stable during a pure pan; only cliff/depth columns intersecting the padded camera frustum are streamed.
- View culling transforms the camera frustum into body-local space, reuses cached cut membership, and selects conservative whole-column radial bounds. It must not restore sector meshes or force a surface-index upload during a pure pan.
- Membership keys and cell indices are numbers, not allocated strings.
- `sliceCentroid` and `geoCache` remain per-cell caches.
- The opaque surface is one persistent mesh with immutable outer-face positions/normals and a worst-case preallocated dynamic index.
- Surface atlas construction appends outer fans directly and must not populate every full-prism `geoCache`.
- The cliff uses at most one retained no-outer prism stream for the depth-0 wall and one full-prism stream per deeper layer; the surface atlas exclusively owns depth-0 outer fans.
- Persistent meshes and geometries are created once/lazily, geometrically grow buffers when needed, and survive empty ranges until body disposal.
- Persistent stream growth keeps mesh/geometry identity, dispatches geometry disposal before replacing attributes, and marks every retained attribute for re-upload.
- Persistent meshes use conservative fixed body-local bounding spheres; movement never recomputes bounds.
- Every active index/stream mutation invalidates a lazy BVH first and preserves triangle-order `faceToCell`; inner prism fans map to `null`.
- Empty persistent streams have zero active draw/index ranges and are invisible, not removed or disposed.
- Panning along an unchanged cut updates only the small camera-visible wall/depth streams when their whole-column membership changes.
- Transient merged geometry for fades and atmosphere uses pre-sized typed arrays and `.set()` copies.
- Fade batches overlap independently. `fadingInKeys` excludes each cell from persistent meshes until its own batch completes.
- Transition slab rebuilds and disabled fades use hard rebuilds.
- Atmosphere pick geometry is marked dirty during movement and built lazily at the first settled pick.
- BVHs are built lazily with `{ indirect: true }` on the first settled resource frame; eager construction during movement breaks advance performance, and non-indirect construction breaks `faceToCell`.
- Settled BVH preparation is pointer-independent so exact sun occlusion resumes when the pointer is outside the canvas.
- Sun occlusion consumes only slice meshes whose current BVHs are ready and retains its last per-body/sun result while dynamic ranges are dirty; it never builds a slice BVH.
- `capMeshes` is refreshed after every ownership change and must never retain disposed meshes.
- Consolidated persistent meshes rely on normal back-face and depth rejection for the full surface; do not reintroduce CPU sector horizon culling.
- Do not introduce `supports()` calls, polymorphic dispatch, object allocation, or string allocation inside per-cell loops.

If abstractions conflict with a hot loop, select a specialized implementation once during construction and keep the loop direct and monomorphic.

## Resource ownership

Every owner of a worker, listener, RAF handle, render target, texture, material, geometry, or transient mesh exposes an idempotent `dispose()`.

- `ExplorerApplication.dispose()` stops RAF/listeners before disposing sessions and bodies.
- `CelestialBody` owns its slice builder, atmosphere shell, body mesh, grid lines, layer materials/textures, and cached cell geometry.
- `BodyMesh` owns mesh geometries but not shared layer materials.
- Slice collaborators dispose only their own transient meshes/material clones.
- A body session clears `clip.onCutChanged` before releasing hover/highlight objects.
- Never dispose shared materials from a mesh owner or retain callbacks to a disposed session.

## Comments and future TypeScript

- Comments explain ownership, invariants, coordinate spaces, or performance decisions. Remove historical attempt logs and comments that restate a method.
- Add JSDoc primarily for config records, cell/focus records, factory inputs, and algorithm result shapes.
- The first future TypeScript types should be `PhysicalConfig`, `BehaviourConfig`, `Cell`, `FocusFrame`, `BodyInteractionSession`, and slice membership/stream records.
- Avoid untyped `userData` additions. Existing `faceToCell`, depth, and highlight-cell metadata should become explicit typed adapters during the TypeScript port.

## Validation

- Parse every explorer module with:

```powershell
Get-ChildItem public\explorer -Recurse -Filter *.js | ForEach-Object {
    Get-Content $_.FullName -Raw | node --input-type=module --check
}
```

- Search deleted concepts before finishing: `physical.planet`, `.planet`, `cellTopology`, `CellTopology`, `createTopology`, `GoldbergBroadPhase`, `CrossSectionFactory`, cap branches, `isPoleCut`, `polarCap`, `InputController`, and broad `retarget` methods.
- Smoke-test `http://localhost:4100/` in a browser and inspect the console.
- Compare fixed view/resource scenarios with the FPS/render-info HUD and `behaviour.debug.sliceProfiler`.
- Do not run TypeScript build or style checks for explorer-only changes.
