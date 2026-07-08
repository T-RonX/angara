import * as THREE from 'three';

import { SceneContext } from './core/SceneContext.js';
import { LightingRig } from './lighting/LightingRig.js';
import { SkyAnchor } from './sky/SkyAnchor.js';
import { StarField } from './sky/StarField.js';
import { StarSystem } from './star/StarSystem.js';
import { AtmosphereSystem } from './atmosphere/AtmosphereSystem.js';
import { CelestialBody } from './model/CelestialBody.js';
import { BodyRegistry } from './world/BodyRegistry.js';
import { OrbitSystem } from './world/OrbitSystem.js';
import { LodController } from './world/LodController.js';
import { CliffPicker } from './picking/CliffPicker.js';
import { HighlightManager } from './picking/HighlightManager.js';
import { HoverController } from './picking/HoverController.js';
import { CrustCamera } from './navigation/CrustCamera.js';
import { FocusController } from './navigation/FocusController.js';
import { InputController } from './navigation/InputController.js';
import { ModeTransition } from './transition/ModeTransition.js';
import { HudView } from './hud/HudView.js';
import { SliderPanel } from './hud/SliderPanel.js';
import { BodyPicker } from './hud/BodyPicker.js';
import { OrbitPanel } from './hud/OrbitPanel.js';
import { LoadingOverlay } from './hud/LoadingOverlay.js';

// ----------------------------------------------------------------------
// BodyExplorer — the application root. It assembles every subsystem from
// the (physical + behaviour) config, owns the shared mutable `state`,
// handles mode switching, and runs the per-frame loop. Each subsystem has a
// single responsibility; this class is just the wiring + the heartbeat.
// ----------------------------------------------------------------------
export class BodyExplorer
{
    #physical;
    #behaviour;
    #planet;
    #root;
    #overlay;

    #scene;
    #state;

    #registry;
    #activeBody;
    #orbits;
    #bodyPicker;
    #orbitPanel;
    #lod;

    #topology;

    #lightingRig;
    #skyAnchor;
    #starSystem;
    #atmosphereSystem;

    #materials;
    #cellGeometry;
    #crossSection;

    #bodyMesh;
    #clip;
    #sliceBuilder;

    #highlights;
    #hover;
    #input;
    #crustCamera;
    #focus;
    #transition;
    #hud;

    #lastFrameT = performance.now();

    constructor(physical, behaviour, rootElement)
    {
        this.#physical = physical;
        this.#behaviour = behaviour;
        this.#planet = physical.planet;
        this.#root = rootElement;

        // Derive every body's radius from its hexFrequency and the global cell
        // size (radius = hexFrequency × cellSize), so all bodies share the same
        // physical cell dimensions. Done once, in place, before any subsystem
        // reads `planet.radius`.
        this.#resolveRadii(this.#planet, physical.cellSize);

        this.#buildScene(rootElement);
        this.#buildSkyAndLights();

        this.#overlay = new LoadingOverlay(rootElement);

        // Initial lighting floor + resize (body-independent).
        this.#lightingRig.applyNight(this.#physical.lighting.nightDarkness);
        window.addEventListener('resize', () => this.#resize());
        this.#resize();
    }

    // Async initialisation: the body may be generated off the main thread, so
    // building it (and everything that wires to it) is awaited behind a loading
    // overlay. Call `await explorer.init()` before `start()`.
    async init()
    {
        this.#overlay.show('Generating body…');

        try
        {
            await this.#buildBodies();
            this.#buildInteraction();
            this.#buildHudControls();
            this.#buildBodyControls();
            this.#resize();
        }
        finally
        {
            this.#overlay.hide();
        }

        return this;
    }

    #resize()
    {
        this.#scene.resize();
        this.#atmosphereSystem?.resize(this.#scene.renderer);
    }

    start()
    {
        this.#animate();
    }

    // --- Construction --------------------------------------------------

    // Recursively set `radius = hexFrequency × cellSize` on a body and all its
    // companions, so downstream consumers keep reading a plain `planet.radius`
    // while cell sizes stay consistent across every body.
    #resolveRadii(config, cellSize)
    {
        config.radius = (config.hexFrequency ?? 16) * cellSize;

        for (const companion of config.companions ?? [])
        {
            this.#resolveRadii(companion, cellSize);
        }
    }

    // Build the active body plus every companion (recursively) from the config,
    // registering each with the OrbitSystem under its parent. The shared
    // subsystems only ever talk to the ACTIVE body's handles (cached via
    // #adoptActiveBody); selecting a companion re-points them.
    async #buildBodies()
    {
        this.#registry = new BodyRegistry();
        this.#orbits = new OrbitSystem(this.#registry);

        await this.#buildBodyTree(this.#planet, null);

        this.#atmosphereSystem = new AtmosphereSystem(this.#registry, this.#starSystem, this.#behaviour);

        this.#adoptActiveBody(this.#registry.active);

        this.#state.camDist =
            (this.#planet.radius - this.layerModel.coreRadius) * this.#behaviour.camera.crustZoom;
    }

    // Depth-first build of one body and its `companions[]` subtree. Each body is
    // generated (off-thread when possible) then linked to its parent's orbit.
    // Each body derives its OWN atmosphere from its config; the star count is
    // shared so every shell compiles for the same number of suns.
    async #buildBodyTree(config, parentBody)
    {
        const body = this.#registry.add(await CelestialBody.create(
            this.#scene.scene, this.#physical, config, this.#behaviour,
            this.#state.focus, this.#starSystem.count, parentBody === null,
        ));

        this.#orbits.add(body, parentBody);

        for (const companion of config.companions ?? [])
        {
            await this.#buildBodyTree(companion, body);
        }

        return body;
    }

    // Cache the active body's handles under the field names the shared
    // subsystems already use, so switching the active body is a single
    // re-point rather than a rewire.
    #adoptActiveBody(body)
    {
        this.#activeBody   = body;
        this.layerModel    = body.layerModel;
        this.cellGrid      = body.cellGrid;
        this.#topology     = body.topology;
        this.#materials    = body.materials;
        this.#cellGeometry = body.cellGeometry;
        this.#crossSection = body.crossSection;
        this.#bodyMesh     = body.bodyMesh;
        this.#clip         = body.clip;
        this.#sliceBuilder = body.sliceBuilder;
    }

    #buildScene(rootElement)
    {
        this.#scene = new SceneContext(rootElement, this.#planet);

        this.#state = {
            mode: 'view',
            selected: null,
            resourceSelected: null,
            focus: {
                lon: 0, lat: 0, lonTarget: 0, latTarget: 0,
                // Hexsphere pole-free frame: dir = focus direction, nCut =
                // cut-plane normal (dir ⟂ nCut), eased toward their *Target
                // counterparts by GoldbergTraversal.
                dir: new THREE.Vector3(1, 0, 0),
                dirTarget: new THREE.Vector3(1, 0, 0),
                nCut: new THREE.Vector3(0, 0, -1),
                nCutTarget: new THREE.Vector3(0, 0, -1),
            },
            camDist: 0, // set in #buildBodies once the active body exists
            viewSnapshot: null,
            transition: { active: false, dir: 0, s: 0, orbit: null },
            resourceMoving: false,
        };
    }

    #buildSkyAndLights()
    {
        const scene = this.#scene.scene;
        const skyDistance = this.#physical.lighting.skyDistance;

        this.#lightingRig = new LightingRig(scene, this.#physical.lighting);
        this.#skyAnchor = new SkyAnchor(scene);

        this.#starSystem = new StarSystem(scene, this.#skyAnchor, this.#physical.stars, {
            planetRadius: this.#planet.radius,
            skyDistance,
        });

        const starField = new StarField(this.#physical.starfield, skyDistance);
        this.#skyAnchor.add(starField.points);
    }

    #buildInteraction()
    {
        const scene = this.#scene.scene;
        const hasAtmosphere = this.cellGrid.atmosphereCells.length > 0;

        this.#hud = new HudView(this.layerModel, hasAtmosphere, this.#topology);

        this.#highlights = new HighlightManager(
            scene,
            this.#topology.createResourceHighlight({
                crossSection: this.#crossSection,
                geometryFactory: this.#cellGeometry,
                clip: this.#clip,
            }),
            this.#cellGeometry, this.#state,
        );

        const surfacePicker = this.#topology.createSurfacePicker(this.#bodyMesh.surfaceMeshes[0]);
        const cliffPicker = new CliffPicker(this.#sliceBuilder, this.#bodyMesh.core);

        this.#hover = new HoverController(
            this.#scene, this.#state, surfacePicker, cliffPicker, this.#highlights, this.#hud,
        );

        // Moving the cut invalidates the hover pick.
        this.#clip.onCutChanged = () => this.#hover.invalidate();

        this.#crustCamera = new CrustCamera(
            this.#scene, this.#clip, this.layerModel, this.#activeBody.planet,
            this.#behaviour.camera, this.#behaviour.input, this.#state, this.#topology.shapeField,
        );

        this.#focus = new FocusController(
            this.#state, this.#topology.traversal, this.#behaviour,
            this.#clip, this.#crustCamera, this.#highlights, this.#hud,
        );

        this.#transition = new ModeTransition(
            this.#state, this.#scene, this.#clip, this.#crustCamera,
            this.#sliceBuilder, this.#highlights, this.#hud, this.#activeBody.planet, this.#behaviour,
            this.#topology.shapeField.maxRadius,
        );

        this.#input = new InputController(
            this.#scene, this.#state, this.#behaviour, this.#activeBody.planet,
            this.layerModel, this.#topology.traversal, this.#crustCamera, this.#highlights,
            {
                toggleMode: () => this.toggleMode(),
                selectSurfaceCell: cell => this.#selectSurfaceCell(cell),
                selectResourceCell: cell => this.#selectResourceCell(cell),
            },
        );
    }

    // Re-point every per-body subsystem at the newly-activated body without
    // rebuilding (and thus without re-binding DOM listeners or duplicating
    // overlay meshes). This is the "single re-point" the body abstraction was
    // designed for: selecting a companion swaps handles, never wiring.
    #retargetInteraction()
    {
        const planet = this.#activeBody.planet;

        // Re-scale the view-mode zoom range to the newly active body's own
        // radius (it was previously pinned to whichever body it was set for
        // in the constructor), so a much smaller/larger companion is always
        // reachable at its own scale.
        this.#scene.setDistanceRange(planet);

        const surfacePicker = this.#topology.createSurfacePicker(this.#bodyMesh.surfaceMeshes[0]);
        const cliffPicker = new CliffPicker(this.#sliceBuilder, this.#bodyMesh.core);

        this.#hover.retarget(surfacePicker, cliffPicker);
        this.#clip.onCutChanged = () => this.#hover.invalidate();

        this.#highlights.retarget(
            this.#topology.createResourceHighlight({
                crossSection: this.#crossSection,
                geometryFactory: this.#cellGeometry,
                clip: this.#clip,
            }),
            this.#cellGeometry,
        );

        this.#crustCamera.retarget(this.#clip, this.layerModel, planet, this.#topology.shapeField);
        this.#focus.retarget(this.#topology.traversal, this.#clip, this.#crustCamera, this.#highlights, this.#hud);
        this.#transition.retarget(
            this.#clip, this.#crustCamera, this.#sliceBuilder, this.#highlights, this.#hud,
            planet, this.#topology.shapeField.maxRadius,
        );
        this.#input.retarget(this.layerModel, this.#topology.traversal, planet, this.#crustCamera, this.#highlights);
        this.#hud.retarget(this.layerModel, this.cellGrid.atmosphereCells.length > 0, this.#topology);

        this.#state.camDist =
            (planet.radius - this.layerModel.coreRadius) * this.#behaviour.camera.crustZoom;
    }

    // Make a different body the active one (companion selection). Only allowed
    // from view mode when no transition is in flight.
    #selectBody(index)
    {
        if (this.#state.mode !== 'view' || this.#state.transition.active) return;

        const target = this.#registry.bodies[index];

        if (!target || target === this.#registry.active) return;

        this.#state.selected = null;
        this.#state.resourceSelected = null;
        this.#highlights.setSurfaceSelectionVisible(false);
        this.#highlights.hideHover();

        this.#registry.setActive(index);
        this.#adoptActiveBody(target);
        this.#retargetInteraction();

        this.#hud.updateSelectionReadout(this.#state);
        this.#hud.refreshModeButton(false);
        this.#bodyPicker?.setActive(index);
        this.#orbitPanel?.retarget(target, this.#orbits.modelFor(target));
    }

    #buildHudControls()
    {
        this.#hud.bindModeButton(() => this.toggleMode());

        new SliderPanel(
            this.#starSystem,
            this.#physical.lighting,
            night => this.#lightingRig.applyNight(night),
        );
    }

    // The companion selection UI + the distance LOD. Both are no-ops for a
    // single-body system (the picker hides itself, the LOD only ever sees the
    // active body), so they cost nothing until companions exist in the config.
    #buildBodyControls()
    {
        this.#bodyPicker = new BodyPicker(
            this.#root, this.#registry.bodies, this.#registry.activeIndex,
            index => this.#selectBody(index),
        );

        this.#orbitPanel = new OrbitPanel(this.#root);
        this.#orbitPanel.retarget(this.#activeBody, this.#orbits.modelFor(this.#activeBody));

        this.#lod = new LodController(
            this.#registry, this.#scene.camera, this.#behaviour.lod,
        );
    }

    // --- Mode switching ------------------------------------------------

    toggleMode()
    {
        this.#setMode(this.#state.mode === 'view' ? 'resource' : 'view');
    }

    #setMode(mode)
    {
        const state = this.#state;

        if (mode === 'resource' && state.selected === null) return;
        if (state.mode === mode && !state.transition.active) return;

        const resource = mode === 'resource';
        state.mode = mode;

        // Shared bookkeeping (applies to both the start and a reversal).
        this.#scene.controls.enabled = false;
        this.#highlights.setSurfaceSelectionVisible(!resource && state.selected !== null);
        this.#highlights.hideHover();
        state.resourceSelected = null;
        this.#highlights.clearResourceSelection();

        this.#hud.setMode(mode);
        this.#hud.updateSelectionReadout(state);

        this.#atmosphereSystem.setMode(mode);

        // Mid-flight toggle: just reverse direction.
        if (state.transition.active)
        {
            state.transition.dir = resource ? 1 : -1;

            return;
        }

        if (resource)
        {
            this.#beginEnterResource();
        }
        else
        {
            this.#beginExitResource();
        }
    }

    #beginEnterResource()
    {
        const state = this.#state;
        const camera = this.#scene.camera;

        const orbit = {
            position: camera.position.clone(),
            up: camera.up.clone(),
            target: this.#scene.controls.target.clone(),
        };
        state.viewSnapshot = orbit;
        state.transition.orbit = orbit;

        const focus = state.focus;
        this.#topology.traversal.enterFocus(focus, state.selected);
        this.#clip.resetCut();

        // Enter resource-mode slicing (lon/lat turns on the GPU clip plane;
        // the hexsphere swaps in its whole-cell slice group) but keep the cut
        // fully off-centre so nothing is sliced yet — the body reads whole at
        // s = 0. Use the shape's max radius so displaced peaks aren't clipped.
        this.#sliceBuilder.enter();
        this.#clip.updateCut(this.#topology.shapeField.maxRadius, true);

        state.transition.s = 0;
        state.transition.dir = 1;
        state.transition.active = true;
    }

    #beginExitResource()
    {
        const state = this.#state;
        const camera = this.#scene.camera;

        if (!state.transition.orbit)
        {
            state.transition.orbit = state.viewSnapshot ?? {
                position: camera.position.clone(),
                up: camera.up.clone(),
                target: new THREE.Vector3(),
            };
        }

        state.transition.s = 1;
        state.transition.dir = -1;
        state.transition.active = true;
    }

    #selectSurfaceCell(cell)
    {
        const state = this.#state;
        state.selected = cell;
        this.#highlights.showSurfaceSelection(cell);

        state.focus.lon = cell.lon;
        state.focus.lat = cell.lat;

        this.#hud.setSelectedSurfaceReadout(cell);
        this.#hud.updateSelectionReadout(state);
        this.#hud.refreshModeButton(true);
    }

    #selectResourceCell(cell)
    {
        const state = this.#state;

        state.resourceSelected = cell;
        this.#highlights.rebuildResourceSelection();

        if (typeof this.#topology.traversal.focusCell === 'function')
        {
            this.#topology.traversal.focusCell(state.focus, cell);
        }

        this.#hud.updateSelectionReadout(state);
    }

    // --- Render loop ---------------------------------------------------

    #animate()
    {
        requestAnimationFrame(() => this.#animate());

        const now = performance.now();
        this.#hud.updateFps(now);
        const dt = Math.min(0.1, (now - this.#lastFrameT) / 1000); // clamp tab-switch gaps
        this.#lastFrameT = now;

        if (this.#state.transition.active)        this.#transition.step(dt);
        else if (this.#state.mode === 'view')     this.#scene.controls.update();
        else                                      this.#focus.easeFocusToTarget();

        // Advance orbits and apply distance LOD (both no-ops for a single body).
        this.#orbits.update(now / 1000);
        this.#lod.update();

        // Advance the hexsphere cell-reveal fade (no-op for lon/lat / when idle).
        if (this.#state.mode === 'resource' && this.#sliceBuilder.tick)
        {
            this.#sliceBuilder.tick(dt);
        }

        // Horizon-cull the resource slice buckets (skip mid-transition: the set
        // rebuilds every frame and the camera is in flight).
        if (this.#state.mode === 'resource' && !this.#state.transition.active && this.#sliceBuilder.updateHorizonCull)
        {
            this.#sliceBuilder.updateHorizonCull(this.#scene.camera);
        }

        // Keep the sky fixed at infinity (no parallax).
        this.#skyAnchor.follow(this.#scene.camera);

        if (!this.#state.transition.active) this.#hover.update();

        this.#hud.updateCompass(this.#scene.camera);

        // Suns: update each sun's disc / flare / occlusion.
        this.#starSystem.update(now, this.#scene.camera);

        // Per-body scattering: position + (throttled) render each visible haze
        // into its cache before the scene, then composite them over the frame.
        this.#atmosphereSystem.update(now, this.#scene.camera, this.#scene.renderer);

        this.#scene.render();
        this.#atmosphereSystem.composite(this.#scene.renderer);
        this.#hud.updateRenderInfo(this.#scene.renderer.info);
    }
}
