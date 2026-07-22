import * as THREE from 'three';
import { discOverlapArea } from '../core/MathUtils.js';

// SunOcclusion -- answers "how much of this sun is currently hidden behind
// a body, as seen from the camera?"
//
// Whenever a body has a currently-visible mesh representation (the base
// surface in view mode, or the cliff/core cut in resource mode), this
// raycasts a spread of sample points across the sun's own angular disc
// against that REAL rendered geometry (BVH-accelerated, see
// ExplorerApplication). A sample is occluded iff the ray actually hits
// before reaching the sun -- this always matches exactly what is on screen,
// with no approximation error, for any body shape and either mode. The
// exact closed-form circle/circle overlap is the first-use fallback while a
// dynamic slice has no ready BVH. Later dirty frames retain the last exact
// per-body result for this sun, avoiding both rebuild stalls and flicker until
// the picker prepares current trees on the first settled resource frame.

// Sun-disc samples used for the numerical integration against a body's real
// surface. Fibonacci-disc distributed for even coverage without grid
// artefacts. Combined with the EMA smoothing in Star.js, this sample count
// is enough to avoid visible flicker while staying cheap (a handful of BVH
// raycasts per occluding body per star per frame).
const DISC_SAMPLES = 24;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export class SunOcclusion
{
    #bodies = [];
    #camToBody = new THREE.Vector3();
    #camToSun  = new THREE.Vector3();
    #sunDirHat = new THREE.Vector3();
    #sunU = new THREE.Vector3();
    #sunV = new THREE.Vector3();
    #sampleDir = new THREE.Vector3();
    #raycaster = new THREE.Raycaster();
    #hits = [];
    #occluderMeshes = [];
    #lastBodyVisibility = new WeakMap();
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

            const exactReady = this.#collectReadyOccluderMeshes(body);
            let visibility;

            if (exactReady)
            {
                visibility = this.#measureAgainstMeshes(
                    this.#occluderMeshes,
                    camera,
                    dSun,
                    sunSize,
                );
                this.#lastBodyVisibility.set(body, visibility);
            }
            else if (this.#lastBodyVisibility.has(body))
            {
                visibility = this.#lastBodyVisibility.get(body);
            }
            else
            {
                visibility = this.#measureSphere(radius, dBody, dSun, sunSize);
            }

            if (visibility < bestVisibility)
            {
                bestVisibility = visibility;
            }
        }

        return bestVisibility;
    }

    // Exact slice occlusion is allowed only when every current mesh already has
    // a BVH. Dynamic slice updates invalidate those trees; CliffPicker rebuilds
    // them lazily after motion settles, independently of pointer state. This
    // path never builds a tree itself.
    #collectReadyOccluderMeshes(body)
    {
        this.#occluderMeshes.length = 0;

        if (body.surfaceMesh && body.surfaceMesh.visible)
        {
            this.#occluderMeshes.push(body.surfaceMesh);

            return Boolean(body.surfaceMesh.geometry?.boundsTree);
        }

        if (body.sliceBuilder && body.sliceBuilder.sliceGroup.visible)
        {
            let ready = body.sliceBuilder.collectReadyOcclusionMeshes(
                this.#occluderMeshes,
            );

            if (body.coreMesh && body.coreMesh.visible)
            {
                this.#occluderMeshes.push(body.coreMesh);
                ready = ready && Boolean(body.coreMesh.geometry?.boundsTree);
            }

            return ready && this.#occluderMeshes.length > 0;
        }

        return false;
    }

    // Exact analytic circle/circle overlap -- defensive fallback for a body
    // with no renderable mesh available at all.
    #measureSphere(radius, dBody, dSun, sunSize)
    {
        const aBody = Math.asin(Math.min(1, radius / dBody));
        const aSun  = Math.asin(Math.min(1, sunSize / dSun));

        const cosSep = THREE.MathUtils.clamp(
            this.#camToBody.dot(this.#camToSun) / (dBody * dSun),
            -1, 1,
        );
        const sep = Math.acos(cosSep);

        const overlap = discOverlapArea(aBody, aSun, sep);
        const sunArea = Math.PI * aSun * aSun;

        return Math.max(0, 1 - overlap / sunArea);
    }

    // Raycasts a spread of points across the sun's disc against the body's
    // actual, currently-visible mesh(es). Exact (matches the rendered
    // silhouette exactly, whatever mode/shape produced it), at the cost of a
    // handful of BVH raycasts.
    #measureAgainstMeshes(meshes, camera, dSun, sunSize)
    {
        this.#sunDirHat.copy(this.#camToSun).divideScalar(dSun);
        this.#limbBasis(this.#sunDirHat, this.#sunU, this.#sunV);

        const aSun = Math.asin(Math.min(1, sunSize / dSun));

        this.#raycaster.far = dSun;
        this.#raycaster.near = 0;

        let occluded = 0;

        for (let i = 0; i < DISC_SAMPLES; i++)
        {
            // Uniform-area Fibonacci sampling of the sun's angular disc.
            const r = aSun * Math.sqrt((i + 0.5) / DISC_SAMPLES);
            const theta = i * GOLDEN_ANGLE;
            const cosR = Math.cos(r);
            const sinR = Math.sin(r);

            this.#sampleDir
                .copy(this.#sunDirHat).multiplyScalar(cosR)
                .addScaledVector(this.#sunU, Math.cos(theta) * sinR)
                .addScaledVector(this.#sunV, Math.sin(theta) * sinR)
                .normalize();

            this.#raycaster.set(camera.position, this.#sampleDir);
            this.#hits.length = 0;
            this.#raycaster.intersectObjects(meshes, false, this.#hits);

            if (this.#hits.length > 0) occluded++;
        }

        return Math.max(0, 1 - occluded / DISC_SAMPLES);
    }

    // Deterministic perpendicular basis for a given unit axis.
    #limbBasis(axisHat, outU, outV)
    {
        outU.set(0, 1, 0).cross(axisHat);

        if (outU.lengthSq() < 1e-8)
        {
            outU.set(1, 0, 0).cross(axisHat);
        }

        outU.normalize();
        outV.crossVectors(axisHat, outU).normalize();
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#bodies = [];
        this.#hits.length = 0;
        this.#occluderMeshes.length = 0;
        this.#lastBodyVisibility = new WeakMap();
    }
}
