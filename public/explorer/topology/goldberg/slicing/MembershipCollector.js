import * as THREE from 'three';

// Gathers the included crust cells per depth, computes a cheap membership
// signature, wall surface, and filters the opaque set against fading-in keys.
// All membership keys are allocation-free numbers: depth * cellStride + cellIndex.
//
// Membership is column-unit: a surface cell (depth 0) is tested once from its
// corners (displacement-aware), and its entire deep stack is emitted together
// for wall-band columns, so every rendered cliff column is a contiguous,
// gap-free depth stack. Atmosphere cells are NOT collected here — they are
// handled lazily by AtmospherePickRenderer.
export class MembershipCollector
{
    #cellGrid;
    #layerModel;
    #eps;
    #wallBandDist;
    #profiler;
    #surfaceCornerCoordinates = null;
    #surfaceCornerDirections = null;
    #surfaceCornerOffsets = null;
    #surfaceCentroidCoordinates = null;
    #columnBounds = null;
    #viewCullEnabled;
    #viewCullPadding;
    #skirtStretch;
    #viewFrustum = new THREE.Frustum();
    #viewProjection = new THREE.Matrix4();
    #bodyToClip = new THREE.Matrix4();
    #lastBodyToClip = new Float64Array(16);
    #viewReady = false;

    // Public: read by CellSliceBuilder for fade-diff key arithmetic and by
    // opaqueExcludingFadingIn so both sides of the exclusion use the same stride.
    cellStride;

    constructor({
        cellGrid,
        layerModel,
        eps,
        wallBandDist,
        cellStride,
        viewCullEnabled,
        viewCullPadding,
        skirtStretch,
        profiler,
    })
    {
        this.#cellGrid     = cellGrid;
        this.#layerModel   = layerModel;
        this.#eps          = eps;
        this.#wallBandDist = wallBandDist;
        this.#profiler     = profiler;
        this.cellStride    = cellStride;
        this.#viewCullEnabled = viewCullEnabled;
        this.#viewCullPadding = viewCullPadding;
        this.#skirtStretch = skirtStretch;
    }

    ensureInitialized()
    {
        if (this.#surfaceCornerCoordinates) return;

        const surface = this.#cellGrid.cellsByDepth[0];
        let cornerCount = 0;

        for (const cell of surface) cornerCount += cell.corners.length;

        this.#surfaceCornerCoordinates = new Float64Array(cornerCount * 3);
        this.#surfaceCornerDirections = new Float64Array(cornerCount * 3);
        this.#surfaceCornerOffsets = new Uint32Array(surface.length + 1);
        this.#surfaceCentroidCoordinates = new Float64Array(surface.length * 3);
        this.#columnBounds = new Float64Array(surface.length * 4);

        let coordinateOffset = 0;

        for (let i = 0; i < surface.length; i++)
        {
            const corners = surface[i].corners;
            const coreRadius = this.#layerModel.coreRadius;
            const crustThickness = this.#layerModel.layerRadii[0] - coreRadius;
            let cx = 0;
            let cy = 0;
            let cz = 0;
            let bx = 0;
            let by = 0;
            let bz = 0;

            this.#surfaceCornerOffsets[i] = coordinateOffset;

            for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex++)
            {
                const corner = corners[cornerIndex];
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.x;
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.y;
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.z;
                const radius = Math.hypot(corner.x, corner.y, corner.z);
                const directionOffset = coordinateOffset - 3;
                this.#surfaceCornerDirections[directionOffset] = corner.x / radius;
                this.#surfaceCornerDirections[directionOffset + 1] = corner.y / radius;
                this.#surfaceCornerDirections[directionOffset + 2] = corner.z / radius;
                cx += corner.x;
                cy += corner.y;
                cz += corner.z;

                if (cornerIndex < surface[i].sides)
                {
                    const deepestInnerRadius = radius - crustThickness;
                    const hemRadius = Math.min(
                        coreRadius * (1 - this.#skirtStretch),
                        deepestInnerRadius * 0.98,
                    );

                    bx += corner.x + corner.x / radius * hemRadius;
                    by += corner.y + corner.y / radius * hemRadius;
                    bz += corner.z + corner.z / radius * hemRadius;
                }
            }

            const centroidOffset = i * 3;
            const scale = 1 / corners.length;

            this.#surfaceCentroidCoordinates[centroidOffset]     = cx * scale;
            this.#surfaceCentroidCoordinates[centroidOffset + 1] = cy * scale;
            this.#surfaceCentroidCoordinates[centroidOffset + 2] = cz * scale;

            const boundOffset = i * 4;
            const boundScale = 1 / (surface[i].sides * 2);
            const centerX = bx * boundScale;
            const centerY = by * boundScale;
            const centerZ = bz * boundScale;
            let boundRadius = 0;

            const outerEnd = this.#surfaceCornerOffsets[i] + surface[i].sides * 3;

            for (let offset = this.#surfaceCornerOffsets[i]; offset < outerEnd; offset += 3)
            {
                const outerX = this.#surfaceCornerCoordinates[offset];
                const outerY = this.#surfaceCornerCoordinates[offset + 1];
                const outerZ = this.#surfaceCornerCoordinates[offset + 2];
                const outerRadius = Math.hypot(outerX, outerY, outerZ);
                const deepestInnerRadius = outerRadius - crustThickness;
                const hemRadius = Math.min(
                    coreRadius * (1 - this.#skirtStretch),
                    deepestInnerRadius * 0.98,
                );
                const innerX = this.#surfaceCornerDirections[offset] * hemRadius;
                const innerY = this.#surfaceCornerDirections[offset + 1] * hemRadius;
                const innerZ = this.#surfaceCornerDirections[offset + 2] * hemRadius;

                boundRadius = Math.max(
                    boundRadius,
                    Math.hypot(outerX - centerX, outerY - centerY, outerZ - centerZ),
                    Math.hypot(innerX - centerX, innerY - centerY, innerZ - centerZ),
                );
            }

            this.#columnBounds[boundOffset] = centerX;
            this.#columnBounds[boundOffset + 1] = centerY;
            this.#columnBounds[boundOffset + 2] = centerZ;
            this.#columnBounds[boundOffset + 3] = boundRadius + this.#viewCullPadding;
        }

        this.#surfaceCornerOffsets[surface.length] = coordinateOffset;
    }

    // Transform the camera frustum into body-local space so column bounds can
    // be tested without transforming any cells or allocating per frame.
    updateView(camera, bodyMatrixWorld)
    {
        if (!this.#viewCullEnabled) return false;

        camera.updateMatrixWorld();
        this.#viewProjection.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        );
        this.#bodyToClip.multiplyMatrices(
            this.#viewProjection,
            bodyMatrixWorld,
        );

        const elements = this.#bodyToClip.elements;
        let changed = !this.#viewReady;

        for (let i = 0; i < 16; i++)
        {
            if (Math.abs(elements[i] - this.#lastBodyToClip[i]) > 1e-8)
            {
                changed = true;
            }

            this.#lastBodyToClip[i] = elements[i];
        }

        if (!changed) return false;

        this.#viewFrustum.setFromProjectionMatrix(this.#bodyToClip);
        this.#viewReady = true;

        return true;
    }

    // One-pass collection of included crust cells and a membership signature.
    // Driven by COLUMNS (not individual cells): each column is tested once from
    // its depth-0 surface-cell corners; depth 0 is always emitted for the whole
    // hemisphere; deeper layers are emitted only for visible wall-band columns.
    collect(n, k, collectKeys = true, applyViewCull = true)
    {
        this.ensureInitialized();

        const startedAt = this.#profiler.now();
        const maxDepth = this.#layerModel.maxDepth;
        const stride   = this.cellStride;
        const byDepth  = [];
        const wallSurface = [];
        const wallCandidates = [];

        for (let d = 0; d < maxDepth; d++) byDepth[d] = [];

        const keys = collectKeys ? new Set() : null;
        const wallKeys = collectKeys ? new Set() : null;
        let hash   = 0;
        let count  = 0;
        let wallCount = 0;

        const cellsByDepth = this.#cellGrid.cellsByDepth;
        const surface      = cellsByDepth[0];
        const cornerCoordinates = this.#surfaceCornerCoordinates;
        const cornerOffsets = this.#surfaceCornerOffsets;
        const centroidCoordinates = this.#surfaceCentroidCoordinates;
        const nx = n.x, ny = n.y, nz = n.z;
        let surfaceHash = 0;

        for (let i = 0; i < surface.length; i++)
        {
            // For displaced bodies include the column if ANY corner is on the
            // kept (+normal) side — more permissive than a centroid-only test.
            let maxDist = -Infinity;

            for (let offset = cornerOffsets[i]; offset < cornerOffsets[i + 1]; offset += 3)
            {
                const dist = nx * cornerCoordinates[offset]
                    + ny * cornerCoordinates[offset + 1]
                    + nz * cornerCoordinates[offset + 2]
                    + k;

                maxDist = Math.max(maxDist, dist);
            }

            // Whole column is off the kept hemisphere.
            if (maxDist < -this.#eps) continue;

            // Depth 0 (the visible surface skin) is always kept so the surface
            // is never holed.
            const surfCell = surface[i];

            byDepth[0].push(surfCell);
            if (keys) keys.add(surfCell.cellIndex);
            count++;
            surfaceHash = (Math.imul(surfaceHash, 31) + surfCell.cellIndex) >>> 0;

            // Non-wall column: surface only (deep cells are occluded).
            const centroidOffset = i * 3;
            const s0 = nx * centroidCoordinates[centroidOffset]
                + ny * centroidCoordinates[centroidOffset + 1]
                + nz * centroidCoordinates[centroidOffset + 2]
                + k;

            const isWall = s0 <= this.#wallBandDist;

            if (!isWall) continue;

            wallCandidates.push(surfCell);

            if (applyViewCull && !this.#visibleAt(i)) continue;

            wallSurface.push(surfCell);
            if (wallKeys) wallKeys.add(surfCell.cellIndex);
            wallCount++;
            count++;
            hash = (Math.imul(hash, 31) + surfCell.cellIndex) >>> 0;

            // Wall column at the cliff: emit the entire deep stack so the
            // column is contiguous (no under-surface notch).
            for (let d = 1; d < maxDepth; d++)
            {
                const cell = cellsByDepth[d][i];

                byDepth[d].push(cell);
                if (keys) keys.add(d * stride + cell.cellIndex);
                count++;
                hash = (Math.imul(hash, 31) + cell.cellIndex * (d + 1)) >>> 0;
            }
        }

        hash = (Math.imul(surfaceHash, 31) + hash) >>> 0;
        this.#profiler.setValue('surfaceColumnsScanned', surface.length);
        this.#profiler.setValue('surfaceColumnsKept', byDepth[0].length);
        this.#profiler.setValue('wallColumns', wallCount);
        this.#profiler.setValue('wallCandidateColumns', wallCandidates.length);
        this.#profiler.setValue('emittedCells', count);
        this.#profiler.recordSince('membershipCollect', startedAt);

        return {
            byDepth,
            wallSurface,
            wallCandidates,
            surface: byDepth[0],
            surfaceHash,
            keys,
            wallKeys,
            count,
            hash,
        };
    }

    // Reuse the unchanged cut membership during a pure pan. Only the local
    // wall/depth stacks are selected again; the large surface atlas stays put.
    refocus(physical, collectKeys = true)
    {
        const startedAt = this.#profiler.now();
        const maxDepth = this.#layerModel.maxDepth;
        const stride = this.cellStride;
        const byDepth = new Array(maxDepth);
        const wallSurface = [];
        const keys = collectKeys ? new Set() : null;
        const wallKeys = collectKeys ? new Set() : null;
        let hash = 0;
        let count = physical.surface.length;

        byDepth[0] = physical.surface;
        for (let d = 1; d < maxDepth; d++) byDepth[d] = [];

        if (keys)
        {
            for (const cell of physical.surface) keys.add(cell.cellIndex);
        }

        for (const surfCell of physical.wallCandidates)
        {
            if (!this.#visibleAt(surfCell.cellIndex)) continue;

            wallSurface.push(surfCell);
            if (wallKeys) wallKeys.add(surfCell.cellIndex);
            count++;
            hash = (Math.imul(hash, 31) + surfCell.cellIndex) >>> 0;

            for (let d = 1; d < maxDepth; d++)
            {
                const cell = this.#cellGrid.cellsByDepth[d][surfCell.cellIndex];

                byDepth[d].push(cell);
                if (keys) keys.add(d * stride + cell.cellIndex);
                count++;
                hash = (Math.imul(hash, 31) + cell.cellIndex * (d + 1)) >>> 0;
            }
        }

        hash = (Math.imul(physical.surfaceHash, 31) + hash) >>> 0;
        this.#profiler.setValue('wallColumns', wallSurface.length);
        this.#profiler.setValue('wallCandidateColumns', physical.wallCandidates.length);
        this.#profiler.setValue('emittedCells', count);
        this.#profiler.recordSince('visibilityCollect', startedAt);

        return { byDepth, wallSurface, keys, wallKeys, count, hash };
    }

    // Per-cell membership test used for atmosphere cells (depth 0, kept across
    // the whole hemisphere) and any non-depth-0 caller.  For displaced bodies
    // a cell is included when ANY corner is on the kept (+normal) side.
    included(cell, n, k)
    {
        const nx = n.x, ny = n.y, nz = n.z;
        let maxDist = -Infinity;

        for (const corner of cell.corners)
        {
            const dist = nx * corner.x + ny * corner.y + nz * corner.z + k;

            maxDist = Math.max(maxDist, dist);
        }

        if (maxDist < -this.#eps) return false;

        if (cell.depth === 0)
        {
            return this.#visibleAt(cell.cellIndex);
        }

        const c = this.#centroid(cell);
        const s = nx * c.x + ny * c.y + nz * c.z + k;

        return s <= this.#wallBandDist;
    }

    #visibleAt(cellIndex)
    {
        if (!this.#viewCullEnabled || !this.#viewReady) return true;

        const offset = cellIndex * 4;
        const bounds = this.#columnBounds;
        const x = bounds[offset];
        const y = bounds[offset + 1];
        const z = bounds[offset + 2];
        const radius = bounds[offset + 3];

        const planes = this.#viewFrustum.planes;

        for (let i = 0; i < 6; i++)
        {
            const plane = planes[i];
            const normal = plane.normal;
            const distance = normal.x * x
                + normal.y * y
                + normal.z * z
                + plane.constant;
            const tolerance = 1e-9 * Math.max(1, radius, Math.abs(distance));

            if (distance < -radius - tolerance) return false;
        }

        return true;
    }

    // Returns byDepth with fading-in cells excluded so they are never rendered
    // twice (both in the opaque slice and in a fade batch).
    opaqueExcludingFadingIn(
        byDepth,
        wallSurface,
        fadingInKeys,
        fadingInWallKeys,
    )
    {
        const startedAt = this.#profiler.now();
        const out    = [];
        const stride = this.cellStride;

        for (let d = 0; d < byDepth.length; d++)
        {
            out[d] = byDepth[d].filter(cell => !fadingInKeys.has(d * stride + cell.cellIndex));
        }

        this.#profiler.recordSince('opaqueFilter', startedAt);

        const opaqueWallSurface = wallSurface.filter(
            cell => !fadingInKeys.has(cell.cellIndex)
                && !fadingInWallKeys.has(cell.cellIndex),
        );

        return { byDepth: out, wallSurface: opaqueWallSurface };
    }

    // Lazily compute and cache the geometric centroid for included() callers
    // outside the precomputed surface-column scan.
    #centroid(cell)
    {
        if (cell.sliceCentroid) return cell.sliceCentroid;

        const c = new THREE.Vector3();

        for (const p of cell.corners) c.add(p);

        c.multiplyScalar(1 / cell.corners.length);
        cell.sliceCentroid = c;

        return cell.sliceCentroid;
    }
}
