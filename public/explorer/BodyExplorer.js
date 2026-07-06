import * as THREE from 'three';

import { SceneContext } from './core/SceneContext.js';
import { LayerModel } from './model/LayerModel.js';
import { LayerMaterialFactory } from './material/LayerMaterialFactory.js';
import { LightingRig } from './lighting/LightingRig.js';
import { SkyAnchor } from './sky/SkyAnchor.js';
import { StarField } from './sky/StarField.js';
import { StarSystem } from './star/StarSystem.js';
import { AtmosphereShell } from './atmosphere/AtmosphereShell.js';
import { CellGeometryFactory } from './geometry/CellGeometryFactory.js';
import { CrossSectionFactory } from './geometry/CrossSectionFactory.js';
import { BodyMesh } from './world/BodyMesh.js';
import { ClipController } from './slicing/ClipController.js';
import { CliffPicker } from './picking/CliffPicker.js';
import { HighlightManager } from './picking/HighlightManager.js';
import { HoverController } from './picking/HoverController.js';
import { CrustCamera } from './navigation/CrustCamera.js';
import { FocusController } from './navigation/FocusController.js';
import { InputController } from './navigation/InputController.js';
import { ModeTransition } from './transition/ModeTransition.js';
import { HudView } from './hud/HudView.js';
import { SliderPanel } from './hud/SliderPanel.js';
import { createTopology } from './topology/createTopology.js';

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

    #topology;

    #lightingRig;
    #skyAnchor;
    #starSystem;
    #atmosphere;

    #materials;
    #cellGeometry;
    #crossSection;

    #bodyMesh;
    #clip;
    #sliceBuilder;

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
        this.#buildTopology();
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
    }

    // Build the active topology and expose its grid. The atmosphere shell
    // radius is needed up-front for the selectable atmosphere cells, so this
    // runs after #buildSkyAndLights().
    #buildTopology()
    {
        this.#topology = createTopology(
            this.#physical, this.layerModel, this.#behaviour, this.#atmosphere.radius,
        );
        this.cellGrid = this.#topology.grid;
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
            camDist: (this.#planet.radius - this.layerModel.coreRadius) * this.#behaviour.camera.crustZoom,
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

        this.#atmosphere = new AtmosphereShell(this.#planet, this.#physical.atmosphere, this.#starSystem.count);
        this.#updateAtmosphereIntensity();
    }

    #buildBody()
    {
        const scene = this.#scene.scene;

        this.#materials = new LayerMaterialFactory(this.#planet, this.layerModel);
        this.#cellGeometry = new CellGeometryFactory(this.#planet.polarCapRings);

        this.#bodyMesh = new BodyMesh(scene, this.cellGrid, this.#cellGeometry, this.#materials, this.layerModel);
        this.#bodyMesh.add(this.#atmosphere.mesh);

        this.#bodyMesh.add(this.#topology.buildGridLines());
    }

    #buildSlicing()
    {
        const scene = this.#scene.scene;

        this.#clip = new ClipController(this.#state.focus, this.#topology.cutStrategy);

        this.#crossSection = new CrossSectionFactory(
            this.#clip.plane, this.#state.focus, this.#planet.radius, this.#planet.polarCapRings,
        );

        this.#sliceBuilder = this.#topology.createSliceBuilder({
            scene,
            clip: this.#clip,
            cellGrid: this.cellGrid,
            crossSection: this.#crossSection,
            materials: this.#materials,
            layerModel: this.layerModel,
            focus: this.#state.focus,
            geometryFactory: this.#cellGeometry,
            bodyMesh: this.#bodyMesh,
        });

        this.#clip.setSliceBuilder(this.#sliceBuilder);
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

        const surfacePicker = this.#topology.createSurfacePicker();
        const cliffPicker = new CliffPicker(this.#sliceBuilder, this.#bodyMesh.core);

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
            this.#state, this.#topology.traversal, this.#behaviour,
            this.#clip, this.#crustCamera, this.#highlights, this.#hud,
        );

        this.#transition = new ModeTransition(
            this.#state, this.#scene, this.#clip, this.#crustCamera,
            this.#sliceBuilder, this.#highlights, this.#hud, this.#planet, this.#behaviour,
        );

        new InputController(
            this.#scene, this.#state, this.#behaviour, this.#planet,
            this.layerModel, this.#topology.traversal, this.#crustCamera, this.#highlights,
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

    #updateAtmosphereIntensity()
    {
        this.#atmosphere.setSunIntensity(
            this.#physical.atmosphere.sunIntensity * this.#starSystem.combinedIntensity(),
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
        this.#atmosphere.mesh.visible = !resource && this.#physical.atmosphere.show;

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
        // s = 0.
        this.#sliceBuilder.enter();
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

        // Advance the hexsphere cell-reveal fade (no-op for lon/lat / when idle).
        if (this.#state.mode === 'resource' && this.#sliceBuilder.tick)
        {
            this.#sliceBuilder.tick(dt);
        }

        // Keep the sky fixed at infinity (no parallax).
        this.#skyAnchor.follow(this.#scene.camera);

        if (!this.#state.transition.active) this.#hover.update();

        this.#hud.updateCompass(this.#scene.camera);

        // Suns: update each sun's disc / flare / occlusion, then feed their
        // directions to the atmosphere so it scatters every sun's light.
        this.#starSystem.update(now, this.#scene.camera);
        this.#updateAtmosphereIntensity();
        this.#atmosphere.setSunDirections(this.#starSystem.directions);
        this.#atmosphere.updateForCamera(this.#scene.camera);

        this.#scene.render();
        this.#hud.updateRenderInfo(this.#scene.renderer.info);
    }
}
