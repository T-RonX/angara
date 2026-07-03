# Gemini CLI Configuration

---
## Project Overview

**Project name:** Angara (working title)  
**Description:** A web based always online multiplayer resource management game where the player collects resources for the greater good. It features a scrollable map with a grid that hides resources which can be mined or harvested. It does not feature combat, instead it is based on working together but no without its challenges.

---

## Technical details

**Backend Framework:** Symfony 7.4; PHP 8.4 (I am a Symfony veteran, just get to the point.)  
**Frontend Framework:** Vue 3; TypeScript (I am new to it, help we explain to teach me.)  
**Database:** MySQL 8.4  
**OS**: Ubuntu
**Web server**: nginx

### Principes

- The project is supposed to become a single-page application (SPA), but served from the Symfony backend.
- Doctrine migrations are not yet used. Changes can be made directly, just use `doctrine:schema:update --force`.
- Tests are not pervasive. There is a functional test suite for the economy tick (see **Testing** below); keep it green and extend it when touching that area. Do not add tests elsewhere unless explicitly asked.

---

## Keeping this file updated

- **Always update this AGENTS.md when you learn something relevant**: a new workflow, an environment gotcha, an architectural decision, a convention, or a command worth remembering. Treat it as the living source of truth for working in this repo so future sessions don't rediscover the same things.

---

## Repository Structure

### Backend:
This is just your typical Symfony project.

`config/`: Contains the typical YAML config for a Symfony project.  
`docker/`: All the Docker containers the project uses (`app` (PHP), `db` (MySQL) and `web` (nginx)).  
`public/`: Entry point for the application.  
`src/`: Contains the usual source code for a typical Symfony structure.  
`templates/`: Contains the usual Twig templates for a typical Symfony structure.  

## Architecture
- Always use transactions for database operations at the highest level like controllers or commands or facades.
- Use fixtures for seeding the database. New seeds should be added as new fixtures.
- In the inline Three.js body explorer (`templates/index/index.html.twig`), the resource-mode clip plane always passes through the body centre, so the cliff exposes the full depth stack (every shell + the core) in both traversal modes.
- In that same inline Three.js renderer, hover/selection highlight materials should keep `depthTest: true` (with polygon offset) to avoid transparent triangle artifacts and missing overlay patches near clipped seams.
- Resource-mode traversal direction is configurable via `CONFIG.resourceTraverseAxis` (`'longitude' | 'latitude'` in `templates/index/index.html.twig`); the clip-plane normal, the cap broad-phase, drag/arrow input mappings, and the camera all branch on it.
  - `'longitude'`: the cut is a meridian (constant-longitude) plane through the poles. You travel around the equator and the poles sit to the left/right. Only a longitude change rebuilds the caps (latitude just pans the camera along the cliff).
  - `'latitude'`: the cut is a through-centre plane whose normal is the north tangent at the focus, so tilting it (changing latitude) sweeps the cut pole-ward. You travel toward the poles and they sit top/bottom. Both axes move the plane, so either change rebuilds the caps.
- The resource camera always looks edge-on along the clip-plane normal with `camera.up` on the surface radial, so depth stays vertical on screen in both modes; only the lateral orientation of the poles changes between axes.
- In `'latitude'` mode the tilted great-circle cut stays within +/- the focus latitude and never reaches the caps while you are between the poles, so cap cells are skipped from that cross-section (`greatCirclePhase` in `buildCaps`). However, the focus latitude can now stroll **onto** a polar cap: `latStops` adds both cap centres to the discrete latitude stops, and when the focus enters the cap band `isPoleCut()` flips the cut to a vertical **meridian** plane (via `updateCut`) so the existing meridian `capCellCrossSection` exposes the pole's full depth/layer stack. Drag/arrow input clamps to `capCenterLatN/S` so the poles are reachable and exitable one stop at a time (`meridianPhase` includes the caps in `buildCaps`).
- The atmosphere can be a **selectable cell shell** (`CONFIG.atmosphereSelectable`, single flag for now — per-body data comes later from the backend). `atmosphereCells` are built on the SAME lon/lat grid (quads + caps) between `planetRadius` and `atmosphereRadius`; the visible haze is still the scattering shader. They are emitted into `buildCaps` as a near-invisible cross-section strip (`atmosphereCapMaterial`, added to `capMeshes` for picking) and are pickable **only in resource mode** (globe-mode `pickSurfaceCellAnalytical` stays surface-only). Their resource-mode hover/selection highlight is a **wireframe box** (full hex, fill hidden) instead of a filled cross-section. The atmosphere **counts as a layer** in the depth readout (`layerLabel`): it's the OUTERMOST layer (layer 1), so the crust layers shift down by one and the total grows by one when the shell exists.
- Lighting: the `sunIntensity` slider drives **only** the direct `sun` light (the lit side). The dark-side fill (`ambient` + `rim` + `hemiFill` + `bottomFill` + the atmosphere glow) is decoupled from it and held at a constant floor scaled by `CONFIG.nightDarkness` (0 = pitch-black night side, 1 = full configured fill) so the night side never tracks the sun. Both are wired to HUD sliders.
- Entering/leaving resource mode is a smooth, configurable fly-through (`CONFIG.modeTransitionMs` in `templates/index/index.html.twig`): the camera eases between the orbit pose and the crust pose (`computeCrustPose()`) while the clip plane sweeps `constant` from `planetRadius` (whole body) to `0` (open slice). It is driven by `stepTransition()`/`finishTransition()` from the `animate()` loop via `state.transition` (`active`/`dir`/`s`/`orbit`). A mid-flight mode-button click just flips `dir` to glide back; all gameplay input is locked while `transition.active`. During the sweep the plane is off-centre, so `buildCaps(slab=true)`/`updateCut(constant, slab)` use a generalised bounding-sphere broad-phase (`cellBounds`) instead of the through-centre column/row phases; polar caps (non-offset-aware `capCellCrossSection`) are skipped mid-sweep and reappear when the cut settles via the final `updateCut(0)`.

## Fixtures and migrations
- Always make sure the foreign keys are the first columns after the primary key or logical order. 

### Frontend:
`assets/`: Root directory for the frontend project.
`assets/src/Rendeder`: Contains a custom render engine based on Canvas 2D. It must remain game agnostic.
`assets/src/Game`: Contains the main game code where not directly part of Vue.
`assets/src/components/Rendering/RenderViewport.vue`: Is the entry point of the application where the Game class is initialized along with some crucial parameters.
`templates/index/index.html.twig`: Current runtime page for `/` (rendered by `IndexController`). It now only holds the HUD markup + styles + the `three` importmap and loads the renderer via `<script type="module" src="/explorer/index.js">`.
`public/explorer/`: The Three.js body/resource renderer, refactored out of the old inline script into small **single-responsibility plain-JS ES modules** (no build step; served statically from `public/`). Data is split from implementation: all tunables live in `public/explorer/config/physical.js` (planet, layers, atmosphere, suns, starfield, lighting) and `config/behaviour.js` (camera, input, traversal, transition) — eventually backend-sourced. `BodyExplorer.js` is the orchestrator (owns `state`, mode switching, the animate loop) and wires the subsystems under `core/`, `model/`, `material/`, `geometry/`, `world/`, `lighting/`, `star/`, `sky/`, `atmosphere/`, `slicing/`, `picking/`, `navigation/`, `transition/`, `hud/`. The old `CONFIG.*` knobs map onto these config objects; behaviour is otherwise unchanged.
  - **Multiple suns**: each light source is a self-contained `star/Star` (its own directional light + sun disc + chromatic halo + starburst + lens flare + occlusion) held in `star/StarSystem`. `atmosphere/AtmosphereShell` sums scattering over `NUM_SUNS` (compiled from the config star count), and `hud/SliderPanel` generates one az/el/intensity control group per sun, so changing `physical.stars[]` rescales lighting, atmosphere and the UI automatically.
  - **Texturing seam (reserved)**: `material/LayerMaterialFactory` already reads `physical.planet.layerTextures` / `layerNormalMaps` (null today) so skinning the visible layer faces later is a data-only change.
  - **Swappable cell topology**: the way the body is divided into cells lives behind the `topology/` abstraction (`topology/CellTopology.js`), selected by ONE config flag `physical.planet.cellTopology` via `topology/createTopology.js`:
    - `'lonlat'` (default) — the longitude/latitude quad grid + polar-cap workaround, wrapped in `topology/LonLatTopology.js` (owns `PolarCapModel`, `LatitudeStops`, `world/CellGrid`, `world/GridLines`, `picking/SurfacePicker`, plus the `topology/lonlat/` cut/broad-phase/traversal strategies). Behaviour unchanged from before the refactor. `behaviour.traversal.resourceTraverseAxis` is meaningful only here.
    - `'hexsphere'` — a Goldberg polyhedron (mostly hexagons + exactly 12 pentagons, **no poles**, so the pole workaround does not exist), in `topology/GoldbergTopology.js` + `topology/goldberg/` (`GoldbergSphere` subdivides an icosahedron → dual; `GoldbergGrid` extrudes per-depth prisms; `CentroidIndex`/`GoldbergSurfacePicker` do nearest-centroid picking; `GoldbergTraversal` does free drag-stroll + snap and adjacency arrow-stepping; `GoldbergCutStrategy` is a generic through-centre meridian cut; `GoldbergBroadPhase` is a bounding-sphere test). Frequency knob: `physical.planet.hexFrequency` (surface has 10·f²+2 cells).
    - Key enabler: every crust/atmosphere cell (quad, pentagon, hexagon) is a uniform **N-gon prism** record `{ kind, depth, lon, lat, outerRing[N], innerRing[N], corners = outer++inner, … }`, so `geometry/CellGeometryFactory`, `geometry/CrossSectionFactory`, `picking/HighlightManager`, `navigation/CrustCamera` and `hud/HudView` are topology-agnostic. The lon/lat polar-cap dome (`kind === 'cap'`) is the only special-cased primitive and lives entirely inside the lonlat topology. The focus point stays `{lon,lat}` for both topologies.
`templates/Game/game.html.twig`: Present but currently a stub; not used by the active game route.

---

## Instructions
- For the backend, strictly adhere to the SOLID principles. Use the Symfony features as much as possible. Always use methods that correspond to the projects Symfony version.
- There is a pattern laid out in `src/CliAccess` that should be used to call controller commands on CLI without invoking the web app for ease.
- Do not remove commented out lines when rewriting a piece of code.
- For PHP always use Allman style (opening braces on new line)
- For Typescript always use typical K&R style.
- Do not run style checks or build for TypeScript after code changes.

---

## Development workflow & environment

- **Run everything through the app container**: `docker exec angara-app php /var/www/html/bin/console <cmd>`. The app root inside the container is `/var/www/html`. Omit `-t` when calling from automated/non-interactive contexts (schema warnings print to stderr and look red in PowerShell, but the commands still succeed).
- **File sync gotcha (important):** the repo is bind-mounted (`.:/var/www/html`), but host↔container syncing is only reliable for **edits to existing files** and for files under subdirectories like `src/` and `config/`. **Newly created files at the repository root do NOT reliably sync host→container** (e.g. a freshly created `phpunit.dist.xml`). When a new root-level file must exist in the container, push it explicitly with `docker cp <hostfile> angara-app:/var/www/html/<file>`. Deletions of entity files also may not propagate — if a removed entity still shows up in `schema:update`, delete it in the container too.
- **No migrations** (project rule): apply schema with `doctrine:schema:update --force`. For a clean rebuild of a database use `doctrine:schema:drop --force --full-database` then `doctrine:schema:create`.
- **PowerShell SQL quoting:** prefer single-quoted SQL passed to `dbal:run-sql`, doubling inner single quotes for string literals, e.g. `dbal:run-sql 'SELECT ... WHERE m.identifier=''iron'''`. The MySQL reserved word table `system` must be backtick-quoted (`` `system` ``).
- Seed/reset the dev database with `make fixtures` (or `make database` for a full reset). The world id changes on every fixtures reload, so re-query `SELECT id FROM world WHERE identifier='angara'` rather than hard-coding it.

## Testing

- Tooling: **PHPUnit** (root `phpunit.dist.xml`, bootstrap `tests/bootstrap.php`). Tests run in the `test` environment against a **dedicated `<dbname>_test` database** (configured via `dbname_suffix` in `config/packages/doctrine.yaml` under `when@test`), so they never touch dev data.
- **Run the suite with `make test`.** It (re)creates the test DB schema from the current entity metadata (no migrations) and runs PHPUnit. Because the schema is rebuilt from metadata each run, entity changes are picked up automatically.
- On Windows PowerShell hosts where `make` is not installed, run PHPUnit directly in the app container: `docker exec angara-app php /var/www/html/bin/phpunit -c /var/www/html/phpunit.dist.xml`.
- Tests live **per bundle** under `src/<Bundle>/tests/`, namespace `App\<Bundle>\Tests\` (registered in the root `composer.json` `autoload-dev`). The economy coverage is `src/GameCoreBundle/tests/Functional/Economy/EconomyTickTest.php`, with test-only fixtures under `src/GameCoreBundle/tests/Fixtures/`.
- Functional tests boot the kernel (`KernelTestCase`) and load fixtures programmatically via Doctrine's `ORMExecutor`/`ORMPurger`. A test may build a large dataset cheaply with bulk DBAL inserts in a dedicated fixture (see `ScaleEconomyWorldFixture`) instead of hydrating thousands of entities.
- When adding a test that needs a specific dataset, add a **dedicated fixture for that test** rather than reusing/altering the demo seed.
- There is a `create-unit-test` skill under `.agents/skills/` for *unit* tests; follow it when asked for unit tests (it does not apply to functional tests).

## Economy tick architecture (scalability)

The economy advances in ticks (`app:economy:tick`, orchestrated by `EconomyTicker`). It is built to scale to hundreds of systems × hundreds of bodies, so keep these invariants when working on it:

- **ORM-free and set-based.** The tick never hydrates the world graph. Input is read via `WorldEconomyReader.streamResourceRows()`, which streams **one system at a time** (each system is a small buffered query, freed before the next) to keep memory flat while preserving system-contiguous order.
- **Streaming two-pass, no O(N) in memory.** Pass 1 (`TickCalculator.aggregate`) folds the row stream into small bounded aggregates and pushes per-body states/flows to writer sinks; pass 2 (`StateEvolver.streamChanges`) re-streams and writes back next-tick reserves/stock. The `TickReport` only retains the bounded aggregates; per-body detail is collected **only** when `EconomyTicker::tick($world, collectDetail: true)` (used for rendering small worlds, never at scale).
- **Bounded current-state read model.** Per-tick results are written to `current_*` tables (one row per body/system/material, overwritten each tick) via bulk DBAL inside a single `connection->transactional()`. No append-only history.
- Bodies can be owned by a player: `CelestialBody.owner` (`player_id`, nullable) ↔ `Player.celestialBodies`.

---

## Code style:

#### Classes
- Avoid getters when possible and use the public private(set) or equivalent.

#### Anonymous functions
- Always use arrow functions, when possible and readable
- Always add a return type
- Always use `static` when the function can be
- Always add a space between `fn` and `(`
- The format should be `static fn (): ReturnType => ...`.

#### Comments
- Method names should not be commented, it should be self-explanatory.

#### Blocks
- Block statements must have a newline above and below (if not the first or last line in another block).

#### Trailing comma
- Always use trailing commas in multi-line arrays or method arguments when each element is on a separate line.

