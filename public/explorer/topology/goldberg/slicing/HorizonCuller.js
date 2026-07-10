// Per-frame horizon occlusion cull for opaque slice buckets. Buckets whose
// angular extent (centre angle from the camera direction + bucket half-angle
// + configurable margin) is beyond the body's horizon are hidden. This is a
// visibility toggle only -- no geometry work, no membership change.
//
// Surface-preserving: each bucket's own bounding-sphere half-angle is added so
// a partially-visible bucket is never dropped. Degenerate case (camera at or
// below the outer surface): all buckets are forced visible and culling is
// suspended until the camera rises above R again.
export class HorizonCuller
{
    #enabled;
    #marginRad;
    #bodyRadius;
    #bodyGroup;
    #active = false;

    constructor({ enabled, marginDeg, bodyRadius, planetRadius, bodyGroup })
    {
        this.#enabled      = enabled ?? false;
        this.#marginRad    = ((marginDeg ?? 6) * Math.PI) / 180;
        this.#bodyRadius   = bodyRadius ?? planetRadius;
        this.#bodyGroup    = bodyGroup;
    }

    // Per-frame update. opaqueBuckets is the Map<key,{mesh}> from BucketStore.
    update(camera, opaqueBuckets)
    {
        if (!this.#enabled) return;

        const R = this.#bodyRadius;

        // Transform camera position to body-local space so the horizon angle
        // and the bucket directions share the same coordinate frame.
        const localCamPos = this.#bodyGroup
            ? this.#bodyGroup.worldToLocal(camera.position.clone())
            : camera.position.clone();

        const d = localCamPos.length();

        // Camera at/under the outer surface — no defined horizon. Restore all
        // buckets to visible so a previous cull does not leave any hidden.
        if (d <= R * 1.001)
        {
            if (this.#active)
            {
                for (const { mesh } of opaqueBuckets.values()) mesh.visible = true;

                this.#active = false;
            }

            return;
        }

        this.#active = true;

        const horizonAngle = Math.acos(R / d);
        const v            = localCamPos.clone().multiplyScalar(1 / d);

        for (const { mesh } of opaqueBuckets.values())
        {
            const bs = mesh.geometry.boundingSphere;

            if (!bs || bs.center.lengthSq() === 0)
            {
                mesh.visible = true;

                continue;
            }

            const dist      = bs.center.length();
            const cDir      = bs.center.clone().multiplyScalar(1 / dist);
            const bucketHalf = Math.asin(Math.min(1, bs.radius / dist));
            const angle     = Math.acos(Math.max(-1, Math.min(1, cDir.dot(v))));

            mesh.visible = angle <= horizonAngle + bucketHalf + this.#marginRad;
        }
    }

    // Reset the active flag (called on exit so a subsequent enter never starts
    // with stale hidden-bucket state).
    reset()
    {
        this.#active = false;
    }

    dispose()
    {
        this.reset();
    }
}
