import * as THREE from 'three';
import { discOverlapArea } from '../core/MathUtils.js';

// SunOcclusion -- answers "how much of this sun is currently hidden behind
// a body, as seen from the camera?" entirely analytically (no raycasts).
//
// Each body is treated as a sphere at its world position and the sun as a
// sphere along its direction. Both project to circles in the camera's field
// of view; the visible fraction is 1 - overlap / sunArea. O(1) per body.
export class SunOcclusion
{
    #bodies = [];
    #camToBody = new THREE.Vector3();
    #camToSun  = new THREE.Vector3();
    #disposed = false;

    constructor(bodies = [])
    {
        this.#bodies = bodies;
    }

    setBodies(bodies)
    {
        this.#bodies = bodies;
    }

    measure(camera, sunWorldPos, sunSize)
    {
        this.#camToSun.copy(sunWorldPos).sub(camera.position);
        const dSun = this.#camToSun.length();

        if (dSun <= 0) return 0;

        let bestVisibility = 1;

        for (const body of this.#bodies)
        {
            const radius = body?.radius ?? 0;
            const position = body?.position ?? body?.worldPosition ?? null;

            if (radius <= 0 || !position) continue;

            this.#camToBody.copy(position).sub(camera.position);
            const dBody = this.#camToBody.length();

            if (dBody <= radius)
            {
                // Camera inside this body ? pathological; treat as fully covered.
                return 0;
            }

            // A sun closer than the body can't be occluded by it.
            if (dSun <= dBody) continue;

            const aBody = Math.asin(Math.min(1, radius / dBody));
            const aSun  = Math.asin(Math.min(1, sunSize / dSun));

            const cosSep = THREE.MathUtils.clamp(
                this.#camToBody.dot(this.#camToSun) / (dBody * dSun),
                -1, 1,
            );
            const sep = Math.acos(cosSep);

            const overlap = discOverlapArea(aBody, aSun, sep);
            const sunArea = Math.PI * aSun * aSun;
            const visibility = Math.max(0, 1 - overlap / sunArea);

            if (visibility < bestVisibility)
            {
                bestVisibility = visibility;
            }
        }

        return bestVisibility;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#bodies = [];
    }
}
