import { CliffPicker } from '../picking/CliffPicker.js';
import { HighlightManager } from '../picking/HighlightManager.js';
import { HoverController } from '../picking/HoverController.js';
import { CrustCamera } from '../navigation/CrustCamera.js';
import { FocusController } from '../navigation/FocusController.js';
import { ModeTransition } from '../transition/ModeTransition.js';
import { ZoomModel } from '../world/ZoomModel.js';
import { SelectionController } from '../selection/SelectionController.js';
import { HighlightMeshFactory } from '../picking/HighlightMeshFactory.js';

// ----------------------------------------------------------------------
// BodyInteractionSession -- a disposable bundle of BODY-BOUND collaborators
// created for whichever body is currently active. When the player selects
// a different body the old session is disposed (releasing meshes, pickers,
// highlights) and a new one is built.
//
// Shared resources (DOM input, HUD, scene, state) are NOT owned here;
// they outlive any single session.
// ----------------------------------------------------------------------
export class BodyInteractionSession
{
    #body;       // CelestialBody
    #state;
    #scene;
    #behaviour;
    #hud;
    #pointerSource;

    #topology;
    #highlights;
    #hover;
    #crustCamera;
    #focus;
    #transition;
    #cliffPicker;
    #surfacePicker;
    #zoom;
    #selection;
    #disposed = false;

    constructor({
        body,
        state,
        sceneContext,
        behaviour,
        hud,
        pointerSource,
    })
    {
        this.#body = body;
        this.#state = state;
        this.#scene = sceneContext;
        this.#behaviour = behaviour;
        this.#hud = hud;
        this.#pointerSource = pointerSource;
        this.#topology = body.topology;

        this.#buildCollaborators();
    }

    get body() { return this.#body; }

    sliceProfilerSnapshot()
    {
        return this.#body.sliceProfiler.snapshot();
    }

    // --- construction --------------------------------------------------

    #buildCollaborators()
    {
        const body    = this.#body;
        const state   = this.#state;
        const scene   = this.#scene;
        const beh     = this.#behaviour;
        const topo    = this.#topology;
        const hasAtmo = body.cellGrid.atmosphereCells.length > 0;

        // HUD is shared -- update its body context.
        this.#hud.setBodyContext(body.layerModel, hasAtmo, topo);

        // Distance range for view-mode orbit zoom.
        scene.setDistanceRange(body.body, beh.camera);

        // Zoom model.
        this.#zoom = new ZoomModel(beh.camera);
        this.#zoom.recalculate(body.layerModel, topo.shapeField);
        state.camDist = this.#zoom.distance;

        // Highlights.
        this.#highlights = new HighlightManager(
            body.group,
            topo.createResourceHighlight({
                geometryFactory: body.cellGeometry,
                clip: body.clip,
            }),
            body.cellGeometry,
            state,
            new HighlightMeshFactory(beh.highlights),
        );

        // Pickers.
        this.#surfacePicker = topo.createSurfacePicker(
            body.bodyMesh.surfaceMeshes[0],
            body.group,
        );
        this.#cliffPicker = new CliffPicker(
            body.sliceBuilder,
            body.bodyMesh.core,
            body.clip.worldPlane,
        );

        // Hover — reads pointer state from the shared InputBinding.
        this.#hover = new HoverController(
            scene, state, this.#surfacePicker, this.#cliffPicker,
            this.#highlights, this.#hud, body.group, this.#pointerSource,
        );

        // Clip → hover invalidation.
        body.clip.onCutChanged = () => this.#hover.invalidate();

        // Crust camera.
        this.#crustCamera = new CrustCamera(
            scene, body.clip, body.layerModel, body.body,
            beh.camera, beh.input, state, topo.shapeField, body.group,
        );

        // Focus easing.
        this.#focus = new FocusController(
            state, topo.traversal, beh,
            body.clip, this.#crustCamera, this.#highlights, this.#hud,
        );

        // Selection controller (surface + resource).
        this.#selection = new SelectionController({
            state,
            topology: topo,
            highlights: this.#highlights,
            hud: this.#hud,
        });

        // Mode transition animation, with completion callbacks.
        this.#transition = new ModeTransition(
            state, scene, body.clip, this.#crustCamera,
            body.sliceBuilder, beh.transition, topo.shapeField.maxRadius,
            {
                onCompleteResource: () =>
                {
                    this.#highlights.rebuildResourceSelection();
                    this.#crustCamera.positionCrustCamera();
                    this.#hud.updateFocusReadout(state.focus);
                },
                onCompleteView: () =>
                {
                    const controls = scene.controls;
                    const camera   = scene.camera;

                    if (state.viewSnapshot)
                    {
                        camera.position.copy(state.viewSnapshot.position);
                        camera.up.copy(state.viewSnapshot.up);
                        controls.target.copy(state.viewSnapshot.target);
                    }
                    else
                    {
                        controls.target.set(0, 0, 0);
                    }

                    controls.enabled = true;
                    controls.update();
                },
            },
        );
    }

    // --- frame-level methods -------------------------------------------

    syncClipPlane()
    {
        this.#body.clip.syncWorldPlane();
    }

    stepTransition(dt)
    {
        this.#transition.step(dt);
    }

    easeFocus()
    {
        this.#focus.easeFocusToTarget();
    }

    positionCamera()
    {
        this.#crustCamera.positionCrustCamera();
    }

    tickSlice(dt)
    {
        if (this.#body.sliceBuilder.tick(dt))
        {
            // Fade completion folds cells into persistent buffers and invalidates
            // their BVHs. Schedule one settled lazy pick so exact occlusion can
            // resume without building trees in the slice-sync path.
            this.#hover.invalidate();
        }
    }

    updateViewCull(camera)
    {
        if (this.#body.sliceBuilder.updateViewCull(camera))
        {
            this.#hover.invalidate();
        }
    }

    updateHover()
    {
        if (this.#state.mode === 'resource' && !this.#state.resourceMoving)
        {
            this.#cliffPicker.prepareOcclusion();
        }

        this.#hover.update();
    }

    // --- mode enter/exit helpers ---------------------------------------

    prepareEnterResource(selectedCell)
    {
        this.#topology.traversal.enterFocus(this.#state.focus, selectedCell);
        this.#body.clip.resetCut();
        this.#body.sliceBuilder.enter();
        this.#body.clip.updateCut(this.#topology.shapeField.maxRadius, true);
    }

    // --- selection -----------------------------------------------------

    selectSurfaceCell(cell)
    {
        this.#selection.selectSurface(cell);
    }

    selectResourceCell(cell)
    {
        this.#selection.selectResource(cell);
    }

    // --- input handlers (called by ExplorerApplication) ----------------

    handleDrag(dx, dy, button)
    {
        if (this.#busy()) return;

        const dpp = this.#crustCamera.dragDegPerPixel();
        this.#topology.traversal.onDrag(this.#state.focus, dx, dy, dpp, button);
    }

    handleDragEnd()
    {
        if (this.#state.mode === 'resource')
        {
            this.#topology.traversal.snapTargets(this.#state.focus);
        }
    }

    handleWheel(deltaY)
    {
        if (this.#busy()) return;

        const factor = deltaY > 0
            ? this.#behaviour.input.wheelZoomOutFactor
            : this.#behaviour.input.wheelZoomInFactor;

        this.#state.camDist = this.#zoom.clamp(this.#state.camDist * factor);
        this.#crustCamera.positionCrustCamera();
    }

    handleArrowKey(key)
    {
        if (this.#busy()) return;

        this.#topology.traversal.onArrow(this.#state.focus, key);
    }

    handleClick()
    {
        if (this.#state.transition.active) return;
        if (!this.#highlights.highlight.visible) return;

        const cell = this.#highlights.hoveredCell;

        if (!cell) return;

        return { cell, mode: this.#state.mode };
    }

    #busy()
    {
        return this.#state.mode !== 'resource' || this.#state.transition.active;
    }

    // --- mode bookkeeping ----------------------------------------------

    applyModeVisuals(mode)
    {
        const state = this.#state;
        const resource = mode === 'resource';

        this.#highlights.setSurfaceSelectionVisible(!resource && state.selected !== null);
        this.#highlights.hideHover();
        this.#highlights.clearResourceSelection();

        this.#hud.setMode(mode);
        this.#hud.updateSelectionReadout(state);
        this.#hud.refreshModeButton(state.selected !== null);
    }

    // --- disposal ------------------------------------------------------

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#body.clip.onCutChanged = null;
        this.#hover.dispose();
        this.#highlights.dispose();
    }
}
