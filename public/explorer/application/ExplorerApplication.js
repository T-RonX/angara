import * as THREE from 'three';

import { SceneContext } from '../core/SceneContext.js';
import { LightingRig } from '../lighting/LightingRig.js';
import { SkyAnchor } from '../sky/SkyAnchor.js';
import { StarField } from '../sky/StarField.js';
import { StarSystem } from '../star/StarSystem.js';
import { AtmosphereSystem } from '../atmosphere/AtmosphereSystem.js';
import { CelestialBody } from '../model/CelestialBody.js';
import { BodyRegistry } from '../world/BodyRegistry.js';
import { OrbitSystem } from '../world/OrbitSystem.js';
import { RotationSystem } from '../world/RotationSystem.js';
import { LodController } from '../world/LodController.js';
import { HudView } from '../hud/HudView.js';
import { HudElements } from '../hud/HudElements.js';
import { SliderPanel } from '../hud/SliderPanel.js';
import { BodyPicker } from '../hud/BodyPicker.js';
import { LoadingOverlay } from '../hud/LoadingOverlay.js';
import { BodyGenService } from '../worker/BodyGenService.js';
import { FrameScheduler } from '../render/FrameScheduler.js';
import { InputBinding } from '../input/InputBinding.js';
import { ModeController } from '../mode/ModeController.js';
import { ActiveBodyController } from './ActiveBodyController.js';
import { BodyInteractionSessionFactory } from './BodyInteractionSessionFactory.js';

// ----------------------------------------------------------------------
// ExplorerApplication — the internal orchestrator that assembles every
// subsystem, owns the shared mutable state, and drives the per-frame loop.
// BodyExplorer is a thin public facade delegating here. index.js is the
// composition root that validates configs, installs BVH and injects the
// physical + behaviour data.
//
// Shared resources (scene, sky, stars, lights, HUD, input binding) are
// built ONCE in the constructor / init. Body-specific collaborators
// (pickers, highlights, camera, focus, transition) live inside a
// disposable BodyInteractionSession managed by ActiveBodyController.
// ----------------------------------------------------------------------
export class ExplorerApplication
{
    #physical;
    #behaviour;
    #root;
    #overlay;

    #scene;
    #state;

    #registry;
    #orbits;
    #rotations;
    #lod;

    #lightingRig;
    #skyAnchor;
    #starField;
    #starSystem;
    #atmosphereSystem;

    #bodyGenService = null;
    #bodyController;
    #modeController;
    #frameScheduler;
    #inputBinding;

    #hud;
    #sliderPanel;
    #bodyPicker;
    #disposed = false;

    // Preallocated star-occlusion body records; updated in place each frame.
    #occlusionRecords = [];

    constructor(physical, behaviour, rootElement)
    {
        this.#physical = physical;
        this.#behaviour = behaviour;
        this.#root = rootElement;

        // Derive radius = hexFrequency × cellSize on every body so
        // downstream consumers keep reading a plain `.radius`.
        this.#resolveRadii(physical.body, physical.cellSize);

        this.#buildScene(rootElement);
        this.#buildSkyAndLights();

        this.#overlay = new LoadingOverlay(rootElement);
        this.#lightingRig.applyNight(this.#behaviour.lighting.nightDarkness);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    async init()
    {
        this.#overlay.show('Generating body…');

        try
        {
            // One shared worker for the entire body tree.
            this.#bodyGenService = this.#behaviour.generation.useWorker
                ? new BodyGenService()
                : null;

            await this.#buildBodies();

            // HUD + slider panel bind once (shared across sessions).
            const hudElements = new HudElements();

            this.#hud = new HudView(
                this.#registry.active.layerModel,
                this.#registry.active.cellGrid.atmosphereCells.length > 0,
                this.#registry.active.topology,
                hudElements,
            );
            this.#buildHudControls();

            // Input binding -- DOM listeners bound exactly once.
            this.#inputBinding = new InputBinding(
                this.#scene.domElement,
                this.#inputCallbacks(),
                this.#behaviour.input,
            );

            // Body controller + initial session.
            const sessionFactory = new BodyInteractionSessionFactory({
                state: this.#state,
                sceneContext: this.#scene,
                behaviour: this.#behaviour,
                hud: this.#hud,
                pointerSource: this.#inputBinding,
            });
            this.#bodyController = new ActiveBodyController(
                this.#registry,
                this.#state,
                sessionFactory,
            );
            this.#bodyController.createSession();

            // Mode controller.
            this.#modeController = new ModeController(
                this.#state, this.#scene,
                (mode, action) => this.#onModeChanged(mode, action),
            );

            // Body picker + LOD (shared across body switches).
            this.#buildBodyControls();

            // Frame scheduler — owns RAF + resize.
            this.#frameScheduler = new FrameScheduler(
                (dt, now) => this.#frame(dt, now),
                () => this.#resize(),
            );

            this.#resize();
        }
        finally
        {
            this.#overlay.hide();
        }

        return this;
    }

    start()
    {
        this.#frameScheduler.start();
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        // Tear down in reverse-init order; idempotent throughout.
        this.#frameScheduler?.dispose();
        this.#inputBinding?.dispose();
        this.#bodyController?.dispose();
        this.#lod?.dispose();
        this.#bodyPicker?.dispose();
        this.#sliderPanel?.dispose();
        this.#hud?.dispose();

        // Dispose every registered body before the scene context.
        for (const body of this.#registry?.bodies ?? [])
        {
            body.dispose();
        }

        this.#atmosphereSystem?.dispose();
        this.#starSystem?.dispose();
        this.#starField?.dispose();

        // Remove sky anchor children from scene before disposing.
        if (this.#skyAnchor?.group)
        {
            this.#skyAnchor.group.removeFromParent();
        }

        this.#bodyGenService?.dispose();
        this.#scene?.dispose();
    }

    // ------------------------------------------------------------------
    // Construction helpers
    // ------------------------------------------------------------------

    #resolveRadii(config, cellSize)
    {
        config.radius = (config.hexFrequency ?? 16) * cellSize;

        for (const companion of config.companions ?? [])
        {
            this.#resolveRadii(companion, cellSize);
        }
    }

    #buildScene(rootElement)
    {
        this.#scene = new SceneContext(
            rootElement,
            this.#physical.body,
            this.#behaviour.scene,
            this.#behaviour.camera,
        );

        this.#state = {
            mode: 'view',
            selected: null,
            resourceSelected: null,
            focus: {
                lon: 0, lat: 0, lonTarget: 0, latTarget: 0,
                dir: new THREE.Vector3(1, 0, 0),
                dirTarget: new THREE.Vector3(1, 0, 0),
                nCut: new THREE.Vector3(0, 0, -1),
                nCutTarget: new THREE.Vector3(0, 0, -1),
            },
            camDist: 0,
            viewSnapshot: null,
            transition: { active: false, dir: 0, s: 0, orbit: null },
            resourceMoving: false,
        };
    }

    #buildSkyAndLights()
    {
        const scene = this.#scene.scene;
        const skyDistance = this.#behaviour.lighting.skyDistance;

        this.#lightingRig = new LightingRig(scene, this.#behaviour.lighting);
        this.#skyAnchor = new SkyAnchor(scene);

        this.#starSystem = new StarSystem(scene, this.#skyAnchor, this.#physical.stars, {
            skyDistance,
        });

        this.#starField = new StarField(this.#behaviour.starfield, skyDistance);
        this.#skyAnchor.add(this.#starField.points);
    }

    async #buildBodies()
    {
        this.#registry = new BodyRegistry();
        this.#orbits = new OrbitSystem(this.#registry);
        this.#rotations = new RotationSystem();

        await this.#buildBodyTree(this.#physical.body, null);

        this.#atmosphereSystem = new AtmosphereSystem(
            this.#registry, this.#starSystem, this.#behaviour,
        );

        // Preallocate star-occlusion records once; updated in place each frame.
        this.#occlusionRecords = this.#registry.bodies.map(() => ({
            radius: 0,
            position: new THREE.Vector3(),
        }));
    }

    async #buildBodyTree(config, parentBody)
    {
        const body = this.#registry.add(await CelestialBody.create(
            this.#scene.scene, config, this.#behaviour,
            this.#state.focus, this.#starSystem.count,
            this.#bodyGenService,
        ));

        this.#orbits.add(body, parentBody);
        this.#rotations.add(body);

        for (const companion of config.companions ?? [])
        {
            await this.#buildBodyTree(companion, body);
        }

        return body;
    }

    #buildHudControls()
    {
        this.#hud.bindModeButton(() => this.#modeController.toggle());

        this.#sliderPanel = new SliderPanel(
            this.#starSystem,
            this.#behaviour.lighting,
            night => this.#lightingRig.applyNight(night),
        );
    }

    #buildBodyControls()
    {
        const hudStack = document.createElement('div');
        hudStack.style.cssText = [
            'position:absolute', 'top:16px', 'right:16px', 'z-index:30',
            'display:flex', 'flex-direction:column', 'align-items:flex-end', 'gap:8px',
            'width:min(220px, calc(100vw - 32px))', 'max-height:calc(100vh - 32px)',
            'overflow-y:auto', 'overflow-x:hidden', 'padding-right:2px',
            'box-sizing:border-box',
        ].join(';');
        this.#root.appendChild(hudStack);

        this.#bodyPicker = new BodyPicker(
            hudStack, this.#registry.bodies, this.#registry.activeIndex,
            index => this.#selectBody(index), this.#orbits, this.#rotations,
        );

        this.#lod = new LodController(
            this.#registry, this.#scene.camera, this.#behaviour.lod,
        );
    }

    // ------------------------------------------------------------------
    // Body selection
    // ------------------------------------------------------------------

    #selectBody(index)
    {
        if (!this.#bodyController.switchBody(index)) return;

        this.#hud.updateSelectionReadout(this.#state);
        this.#hud.refreshModeButton(false);
        this.#bodyPicker?.setActive(index);
    }

    // ------------------------------------------------------------------
    // Mode change callback
    // ------------------------------------------------------------------

    #onModeChanged(mode, action)
    {
        const session = this.#bodyController.session;

        // Visual bookkeeping applies on every mode change (enter, exit, reverse).
        session.applyModeVisuals(mode);
        this.#atmosphereSystem.setMode(mode);

        // Body-specific enter hooks only when starting (not reversing mid-flight).
        if (action === 'enter')
        {
            session.prepareEnterResource(this.#state.selected);
        }
    }

    // ------------------------------------------------------------------
    // Input callbacks
    // ------------------------------------------------------------------

    #inputCallbacks()
    {
        return {
            onDrag: (dx, dy, button) =>
            {
                this.#bodyController.session?.handleDrag(dx, dy, button);
            },

            onDragEnd: () =>
            {
                this.#bodyController.session?.handleDragEnd();
            },

            onWheel: (e) =>
            {
                if (this.#state.mode !== 'resource' || this.#state.transition.active) return;

                e.preventDefault();
                this.#bodyController.session?.handleWheel(e.deltaY);
            },

            onKeyDown: (e) =>
            {
                if (e.key.toLowerCase() === 'r')
                {
                    this.#modeController?.toggle();

                    return;
                }

                this.#bodyController.session?.handleArrowKey(e.key);
            },

            onClick: () =>
            {
                const result = this.#bodyController.session?.handleClick();

                if (!result) return;

                if (result.mode === 'view')
                {
                    if (result.cell.depth !== 0) return;

                    this.#bodyController.session.selectSurfaceCell(result.cell);
                }
                else
                {
                    this.#bodyController.session.selectResourceCell(result.cell);
                }
            },

            onContextMenu: (e) =>
            {
                if (this.#state.mode === 'resource') e.preventDefault();
            },
        };
    }

    // ------------------------------------------------------------------
    // Frame loop — preserves exact ordering
    // ------------------------------------------------------------------

    #frame(dt, now)
    {
        this.#hud.updateFps(now);

        const session = this.#bodyController.session;
        const state = this.#state;

        // 1. Orbits + rotations.
        this.#orbits.update(now / 1000);
        this.#rotations.update(dt);

        // 2. World matrices + active body clip sync.
        this.#scene.scene.updateMatrixWorld();
        session.syncClipPlane();

        // 3. Mode camera (transition / view / resource).
        this.#modeController.updateCamera(session, dt);

        // 4. LOD.
        this.#lod.update();

        // 5. Slice fades + horizon cull (resource mode only).
        if (state.mode === 'resource')
        {
            session.tickSlice(dt);

            if (!state.transition.active)
            {
                session.updateHorizonCull(this.#scene.camera);
            }
        }

        // 6. Sky at infinity.
        this.#skyAnchor.follow(this.#scene.camera);

        // 7. Hover pick.
        if (!state.transition.active) session.updateHover();

        // 8. Compass.
        this.#hud.updateCompass(this.#scene.camera);

        // 9. Star occlusion + update (preallocated records, no per-frame alloc).
        const bodies = this.#registry.bodies;
        for (let i = 0; i < bodies.length; i++)
        {
            const rec = this.#occlusionRecords[i];
            rec.radius = bodies[i].radius;
            bodies[i].group.getWorldPosition(rec.position);
        }
        this.#starSystem.setOcclusionBodies(this.#occlusionRecords);
        this.#starSystem.update(now, this.#scene.camera);

        // 10. Atmosphere update.
        this.#atmosphereSystem.update(
            now, this.#scene.camera, this.#scene.renderer,
        );

        // 11. Scene render.
        this.#scene.render();

        // 12. Atmosphere composite.
        this.#atmosphereSystem.composite(this.#scene.renderer);

        // 13. Render info.
        this.#hud.updateRenderInfo(this.#scene.renderer.info);
    }

    // ------------------------------------------------------------------
    // Resize
    // ------------------------------------------------------------------

    #resize()
    {
        this.#scene.resize();
        this.#atmosphereSystem?.resize(this.#scene.renderer);
    }
}
