import * as THREE from 'three';

// Close-range cell outlines are kept as a separate, lazily materialised
// overlay. High-frequency bodies never pay for the large line buffer unless
// the camera gets close enough for individual Goldberg cells to be useful.
export class GoldbergGridLines
{
    lines;

    #body;
    #faces;
    #shapeField;
    #config;
    #worldPosition = new THREE.Vector3();
    #built = false;
    #disposed = false;

    constructor(body, faces, shapeField, config)
    {
        this.#body = body;
        this.#faces = faces;
        this.#shapeField = shapeField;
        this.#config = config;

        const material = new THREE.LineBasicMaterial({
            color: body.gridColor,
            transparent: true,
            opacity: 0,
            depthTest: true,
            depthWrite: false,
        });

        this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), material);
        this.lines.visible = false;
    }

    update(camera, bodyGroup, surfaceVisible)
    {
        if (this.#disposed || !this.#config.enabled || !surfaceVisible)
        {
            this.lines.visible = false;

            return;
        }

        bodyGroup.getWorldPosition(this.#worldPosition);
        const radiusDistance = camera.position.distanceTo(this.#worldPosition) / this.#body.radius;

        if (radiusDistance >= this.#config.fadeEndRadius)
        {
            this.lines.visible = false;

            return;
        }

        if (!this.#built)
        {
            this.#built = true;
            this.lines.geometry.dispose();
            this.lines.geometry = this.#buildGeometry();
            this.#faces = null;
            this.#shapeField = null;
        }

        const fade = 1 - smoothstep(
            this.#config.fadeStartRadius,
            this.#config.fadeEndRadius,
            radiusDistance,
        );
        this.lines.material.opacity = this.#config.opacity * fade;
        this.lines.visible = this.lines.material.opacity > 0.001;
    }

    #buildGeometry()
    {
        let segmentCount = 0;

        for (const face of this.#faces) segmentCount += face.corners.length;

        const positions = new Float32Array(segmentCount * 2 * 3);
        const lift = this.#body.radius * this.#config.surfaceLift;
        let offset = 0;

        for (const face of this.#faces)
        {
            const ring = face.corners;

            for (let corner = 0; corner < ring.length; corner++)
            {
                offset = writePoint(
                    positions,
                    offset,
                    ring[corner],
                    this.#shapeField.surfaceRadius(ring[corner]) + lift,
                );
                const next = ring[(corner + 1) % ring.length];
                offset = writePoint(
                    positions,
                    offset,
                    next,
                    this.#shapeField.surfaceRadius(next) + lift,
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeBoundingSphere();

        return geometry;
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.lines.removeFromParent();
        this.lines.geometry.dispose();
        this.lines.material.dispose();
        this.#faces = null;
        this.#shapeField = null;
    }
}

function writePoint(target, offset, point, radius)
{
    target[offset++] = point.x * radius;
    target[offset++] = point.y * radius;
    target[offset++] = point.z * radius;

    return offset;
}

function smoothstep(edge0, edge1, value)
{
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));

    return t * t * (3 - 2 * t);
}
