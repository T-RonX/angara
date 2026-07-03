import * as THREE from 'three';

import { SceneContext } from './core/SceneContext.js';
import { LayerModel } from './model/LayerModel.js';
import { PolarCapModel } from './model/PolarCapModel.js';
import { LatitudeStops } from './model/LatitudeStops.js';
import { LayerMaterialFactory } from './material/LayerMaterialFactory.js';
import { LightingRig } from './lighting/LightingRig.js';
import { SkyAnchor } from './sky/SkyAnchor.js';
import { StarField } from './sky/StarField.js';
import { StarSystem } from './star/StarSystem.js';
import { AtmosphereShell } from './atmosphere/AtmosphereShell.js';
import { CellGeometryFactory } from './geometry/CellGeometryFactory.js';
import { CrossSectionFactory } from './geometry/CrossSectionFactory.js';
import { CellGrid } from './world/CellGrid.js';
import { BodyMesh } from './world/BodyMesh.js';
import { GridLines } from './world/GridLines.js';
import { ClipController } from './slicing/ClipController.js';
import { CapBuilder } from './slicing/CapBuilder.js';
import { SurfacePicker } from './picking/SurfacePicker.js';
import { CliffPicker } from './picking/CliffPicker.js';
import { HighlightManager } from './picking/HighlightManager.js';
import { HoverController } from './picking/HoverController.js';
import { CrustCamera } from './navigation/CrustCamera.js';
import { FocusController } from './navigation/FocusController.js';
import { InputController } from './navigation/InputController.js';
import { ModeTransition } from './transition/ModeTransition.js';
import { HudView } from './hud/HudView.js';
import { SliderPanel } from './hud/SliderPanel.js';

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

    #scene;
    #state;

    #lightingRig;
    #skyAnchor;
    #starSystem;
    #atmosphere;

    #materials;
    #cellGeometry;
    #crossSection;

    #bodyMesh;
    #clip;
    #capBuilder;

    #highlights;
    #hover;
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

        this.#buildModels();
        this.#buildScene(rootElement);
        this.#buildSkyAndLights();
        this.#buildBody();
        this.#buildSlicing();
        this.#buildInteraction();
        this.#buildHudControls();

        // Initial lighting floor + resize.
        this.#lightingRig.applyNight(this.#physical.lighting.nightDarkness);
        window.addEventListener('resize', () => this.#scene.resize());
        this.#scene.resize();
    }

    start()
    {
        this.#animate();
    }

    // --- Construction --------------------------------------------------

    #buildModels()
    {
        this.layerModel = new LayerModel(this.#planet);
        this.capModel = new PolarCapModel(this.#planet);
        this.latStops = new LatitudeStops(this.#planet, this.capModel);
    }

    #buildScene(rootElement)
    {
        this.#scene = new SceneContext(rootElement, this.#planet);

        this.#state = {
            mode: 'view',
            selected: null,
            resourceSelected: null,
            focus: { lon: 0, lat: 0, lonTarget: 0, latTarget: 0 },
            camDist: (this.#planet.radius - this.layerModel.coreRadius) * this.#behaviour.camera.crustZoom,
            viewSnapshot: null,
            transition: { active: false, dir: 0, s: 0, orbit: null },
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

        this.#atmosphere = new AtmosphereShell(this.#planet, this.#physical.atmosphere, this.#starSystem.count);
    }

    #buildBody()
    {
        const scene = this.#scene.scene;

        this.#materials = new LayerMaterialFactory(this.#planet, this.layerModel);
        this.#cellGeometry = new CellGeometryFactory(this.#planet.polarCapRings);
        this.cellGrid = new CellGrid(
            this.#planet, this.layerModel, this.capModel,
            this.#physical.atmosphere, this.#atmosphere.radius,
        );

        this.#bodyMesh = new BodyMesh(scene, this.cellGrid, this.#cellGeometry, this.#materials, this.layerModel);
        this.#bodyMesh.add(this.#atmosphere.mesh);

        const gridLines = new GridLines(this.#planet, this.capModel);
        this.#bodyMesh.add(gridLines.lines);
    }

    #buildSlicing()
    {
        const scene = this.#scene.scene;
        const axis = this.#behaviour.traversal.resourceTraverseAxis;

        this.#clip = new ClipController(this.#state.focus, axis, this.capModel);

        this.#crossSection = new CrossSectionFactory(
            this.#clip.plane, this.#state.focus, this.#planet.radius, this.#planet.polarCapRings,
        );

        this.#capBuilder = new CapBuilder(
            scene, this.#clip, this.cellGrid, this.#crossSection, this.#materials,
            this.layerModel, this.#state.focus, this.#planet, axis, this.capModel,
        );

        this.#clip.setCapBuilder(this.#capBuilder);
    }

    #buildInteraction()
    {
        const scene = this.#scene.scene;
        const hasAtmosphere = this.cellGrid.atmosphereCells.length > 0;

        this.#hud = new HudView(this.layerModel, hasAtmosphere);

        this.#highlights = new HighlightManager(
            scene, this.#crossSection, this.#cellGeometry, this.#clip, this.#state, this.#planet.polarCapRings,
        );

        const surfacePicker = new SurfacePicker(this.#planet, this.capModel, this.cellGrid);
        const cliffPicker = new CliffPicker(this.#capBuilder);

        this.#hover = new HoverController(
            this.#scene, this.#state, surfacePicker, cliffPicker, this.#highlights, this.#hud,
        );

        // Moving the cut invalidates the hover pick.
        this.#clip.onCutChanged = () => this.#hover.invalidate();

        this.#crustCamera = new CrustCamera(
            this.#scene, this.#clip, this.layerModel, this.#planet,
            this.#behaviour.camera, this.#behaviour.input, this.#state,
        );

        this.#focus = new FocusController(
            this.#state, this.#planet, this.capModel, this.latStops, this.#behaviour,
            this.#clip, this.#crustCamera, this.#highlights, this.#hud,
        );

        this.#transition = new ModeTransition(
            this.#state, this.#scene, this.#clip, this.#crustCamera, this.#bodyMesh,
            this.#capBuilder, this.#highlights, this.#hud, this.#planet, this.#behaviour,
        );

        new InputController(
            this.#scene, this.#state, this.#behaviour, this.#planet, this.capModel,
            this.layerModel, this.latStops, this.#focus, this.#crustCamera, this.#highlights,
            {
                toggleMode: () => this.toggleMode(),
                selectSurfaceCell: cell => this.#selectSurfaceCell(cell),
                selectResourceCell: cell => this.#selectResourceCell(cell),
            },
        );
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
        focus.lon = state.selected.lon;
        focus.lat = state.selected.lat;
        focus.lonTarget = this.#focus.snapLonToCol(state.selected.lon);
        focus.latTarget = this.#focus.snapLatToRow(state.selected.lat);
        focus.lon = focus.lonTarget;
        focus.lat = focus.latTarget;
        this.#clip.resetCut();

        // Enable clipping but keep the plane fully off-centre so nothing is
        // sliced yet — the body still reads whole at s = 0.
        this.#bodyMesh.applyClipping(true, this.#clip.plane);
        this.#clip.updateCut(this.#planet.radius, true);

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
        // Selection is decoupled from navigation on purpose: clicking only
        // marks the cell (navigation stays on drag + arrow keys).
        this.#state.resourceSelected = cell;
        this.#highlights.rebuildResourceSelection();
        this.#hud.updateSelectionReadout(this.#state);
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

        // Keep the sky fixed at infinity (no parallax).
        this.#skyAnchor.follow(this.#scene.camera);

        if (!this.#state.transition.active) this.#hover.update();

        this.#hud.updateCompass(this.#scene.camera);

        // Suns: update each sun's disc / flare / occlusion, then feed their
        // directions to the atmosphere so it scatters every sun's light.
        this.#starSystem.update(now, this.#scene.camera);
        this.#atmosphere.setSunDirections(this.#starSystem.directions);

        this.#scene.render();
    }
}


