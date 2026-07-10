import * as THREE from 'three';
import { deg2rad } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// CrustCamera -- frames the crust cliff in resource mode. It looks at the
// cut edge-on so the surface-to-max-depth layers run top-to-bottom,
// following the body's curvature from the focus point. It also reports how
// many degrees of lat/lon one screen pixel of drag is worth at the current
// zoom, so the cursor stays glued to the surface.
// ----------------------------------------------------------------------
export class CrustCamera
{
    #sceneContext;
    #clip;
    #layerModel;
    #body;
    #cameraCfg;
    #input;
    #state;
    #shapeField;
    #bodyGroup = null;
    #bodyQ = new THREE.Quaternion();

    constructor(sceneContext, clipController, layerModel, body, cameraCfg, input, state, shapeField, bodyGroup = null)
    {
        this.#sceneContext = sceneContext;
        this.#clip = clipController;
        this.#layerModel = layerModel;
        this.#body = body;
        this.#cameraCfg = cameraCfg;
        this.#input = input;
        this.#state = state;
        this.#shapeField = shapeField ?? null;
        this.#bodyGroup = bodyGroup ?? null;
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

        return this.#body.radius;
    }

    // Compute (but don't apply) the crust-cliff pose for the current focus,
    // as { position, up, target } in world space. Accounts for the body's
    // current rotation and position so resource mode follows a spinning body.
    computeCrustPose()
    {
        const focus = this.#state.focus;
        const coreRadius = this.#layerModel.coreRadius;

        // The hexsphere always provides focus.dir; use it directly.
        const radialLocal = focus.dir.clone();

        const surfaceRadius = this.#focusSurfaceRadius(radialLocal);
        const maxRadius = this.#shapeField?.maxRadius ?? surfaceRadius;
        const midStackR = (maxRadius + coreRadius) / 2;

        // Body world position and quaternion.
        const bodyPos = this.#bodyGroup
            ? this.#bodyGroup.getWorldPosition(new THREE.Vector3())
            : new THREE.Vector3();
        const bodyQ = this.#bodyGroup
            ? this.#bodyGroup.getWorldQuaternion(this.#bodyQ)
            : null;

        // Rotate local radial to world space.
        const radialUp = bodyQ ? radialLocal.clone().applyQuaternion(bodyQ) : radialLocal.clone();

        // World-space cut normal: use the already-synced worldPlane if available,
        // otherwise fall back to rotating the local plane normal.
        const cutNormal = this.#clip.worldPlane
            ? this.#clip.worldPlane.normal.clone()
            : (bodyQ
                ? this.#clip.plane.normal.clone().applyQuaternion(bodyQ)
                : this.#clip.plane.normal.clone());
        const m = cutNormal.multiplyScalar(-1);

        // Target at the midpoint of entire crust stack in world space.
        const target = bodyPos.clone().add(radialUp.clone().multiplyScalar(midStackR));

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
