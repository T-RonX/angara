import * as THREE from 'three';
import { deg2rad } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// CrustCamera — frames the crust cliff in resource mode. It looks at the
// cut edge-on so the surface→max-depth layers run top→bottom, following the
// body's curvature from the focus point. It also reports how many degrees
// of lat/lon one screen pixel of drag is worth at the current zoom, so the
// cursor stays glued to the surface.
// ----------------------------------------------------------------------
export class CrustCamera
{
    #sceneContext;
    #clip;
    #layerModel;
    #planet;
    #cameraCfg;
    #input;
    #state;
    #shapeField;

    constructor(sceneContext, clipController, layerModel, planet, cameraCfg, input, state, shapeField)
    {
        this.#sceneContext = sceneContext;
        this.#clip = clipController;
        this.#layerModel = layerModel;
        this.#planet = planet;
        this.#cameraCfg = cameraCfg;
        this.#input = input;
        this.#state = state;
        this.#shapeField = shapeField ?? null;
    }

    retarget(clipController, layerModel, planet, shapeField)
    {
        this.#clip = clipController;
        this.#layerModel = layerModel;
        this.#planet = planet;
        this.#shapeField = shapeField ?? null;
    }

    // Local surface radius at the focus direction (the displaced body's radius
    // where the camera is looking). Falls back to the base radius for a sphere.
    #focusSurfaceRadius(radialUp)
    {
        if (this.#shapeField && !this.#shapeField.isSphere)
        {
            const dir = this.#state.focus.dir ?? radialUp;

            if (dir) return this.#shapeField.surfaceRadius(dir);
        }

        return this.#planet.radius;
    }

    // Compute (but don't apply) the crust-cliff pose for the current focus,
    // as { position, up, target } — so the transition can interpolate it.
    computeCrustPose()
    {
        const focus = this.#state.focus;
        const coreRadius = this.#layerModel.coreRadius;

        const lonR = deg2rad(focus.lon);
        const latR = deg2rad(focus.lat);

        const radialUp = new THREE.Vector3(
            Math.cos(latR) * Math.cos(lonR),
            Math.sin(latR),
            Math.cos(latR) * Math.sin(lonR),
        );

        const surfaceRadius = this.#focusSurfaceRadius(radialUp);
        // Center vertically at the midpoint between core and peak surface (entire stack)
        const maxRadius = this.#shapeField?.maxRadius ?? surfaceRadius;
        const midStackR = (maxRadius + coreRadius) / 2;

        // Face the cut edge-on: the clip-plane normal is the cut's facing
        // direction, so offset the camera along its negation. Keeping `up` on
        // the radial keeps depth pointing straight down on screen.
        const m = this.#clip.plane.normal.clone().multiplyScalar(-1);

        // Target at the midpoint of entire crust stack (core to peak)
        const target = radialUp.clone().multiplyScalar(midStackR);

        const tilt = this.#cameraCfg.crustTilt;
        const position = target.clone()
            .add(m.clone().multiplyScalar(this.#state.camDist * Math.cos(tilt)))
            .add(radialUp.clone().multiplyScalar(this.#state.camDist * Math.sin(tilt)));

        return { position, up: radialUp, target };
    }

    positionCrustCamera()
    {
        const pose = this.computeCrustPose();
        const camera = this.#sceneContext.camera;

        camera.position.copy(pose.position);
        camera.up.copy(pose.up);
        camera.lookAt(pose.target);
    }

    // Degrees of lat/lon per screen pixel of drag, derived from the camera
    // FOV and the crust-view distance so the cursor tracks the surface.
    dragDegPerPixel()
    {
        const camera = this.#sceneContext.camera;
        const h = this.#sceneContext.domElement.clientHeight || 1;
        
        const surfaceRadius = this.#focusSurfaceRadius();
        const maxRadius = this.#shapeField?.maxRadius ?? surfaceRadius;
        const midR = (maxRadius + this.#layerModel.coreRadius) / 2;

        const worldPerPx = (2 * this.#state.camDist * Math.tan(deg2rad(camera.fov) / 2)) / h;
        const degLatPerPx = worldPerPx * 180 / Math.PI / midR;
        const cosLat = Math.max(Math.cos(deg2rad(this.#state.focus.lat)), 0.05);
        const degLonPerPx = degLatPerPx / cosLat;

        return {
            lat: degLatPerPx * this.#input.dragSensitivity,
            lon: degLonPerPx * this.#input.dragSensitivity,
        };
    }
}

