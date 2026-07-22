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
    #surfaceCornerOffsets = null;
    #surfaceCentroidCoordinates = null;

    // Public: read by CellSliceBuilder for fade-diff key arithmetic and by
    // opaqueExcludingFadingIn so both sides of the exclusion use the same stride.
    cellStride;

    constructor({ cellGrid, layerModel, eps, wallBandDist, cellStride, profiler })
    {
        this.#cellGrid     = cellGrid;
        this.#layerModel   = layerModel;
        this.#eps          = eps;
        this.#wallBandDist = wallBandDist;
        this.#profiler     = profiler;
        this.cellStride    = cellStride;
    }

    ensureInitialized()
    {
        if (this.#surfaceCornerCoordinates) return;

        const surface = this.#cellGrid.cellsByDepth[0];
        let cornerCount = 0;

        for (const cell of surface) cornerCount += cell.corners.length;

        this.#surfaceCornerCoordinates = new Float64Array(cornerCount * 3);
        this.#surfaceCornerOffsets = new Uint32Array(surface.length + 1);
        this.#surfaceCentroidCoordinates = new Float64Array(surface.length * 3);

        let coordinateOffset = 0;

        for (let i = 0; i < surface.length; i++)
        {
            const corners = surface[i].corners;
            let cx = 0;
            let cy = 0;
            let cz = 0;

            this.#surfaceCornerOffsets[i] = coordinateOffset;

            for (const corner of corners)
            {
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.x;
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.y;
                this.#surfaceCornerCoordinates[coordinateOffset++] = corner.z;
                cx += corner.x;
                cy += corner.y;
                cz += corner.z;
            }

            const centroidOffset = i * 3;
            const scale = 1 / corners.length;

            this.#surfaceCentroidCoordinates[centroidOffset]     = cx * scale;
            this.#surfaceCentroidCoordinates[centroidOffset + 1] = cy * scale;
            this.#surfaceCentroidCoordinates[centroidOffset + 2] = cz * scale;
        }

        this.#surfaceCornerOffsets[surface.length] = coordinateOffset;
    }

    // One-pass collection of included crust cells and a membership signature.
    // Driven by COLUMNS (not individual cells): each column is tested once from
    // its depth-0 surface-cell corners; depth 0 is always emitted for the whole
    // hemisphere; deeper layers are emitted only for wall-band columns so the
    // cliff is a solid stack with no gaps and the occluded interior is dropped.
    collect(n, k, collectKeys = true)
    {
        this.ensureInitialized();

        const startedAt = this.#profiler.now();
        const maxDepth = this.#layerModel.maxDepth;
        const stride   = this.cellStride;
        const byDepth  = [];
        const wallSurface = [];

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
            hash = (Math.imul(hash, 31) + surfCell.cellIndex) >>> 0;

            // Non-wall column: surface only (deep cells are occluded).
            const centroidOffset = i * 3;
            const s0 = nx * centroidCoordinates[centroidOffset]
                + ny * centroidCoordinates[centroidOffset + 1]
                + nz * centroidCoordinates[centroidOffset + 2]
                + k;

            const isWall = s0 <= this.#wallBandDist;

            hash = (Math.imul(hash, 31) + (isWall ? 1 : 0)) >>> 0;

            if (!isWall) continue;

            wallSurface.push(surfCell);
            if (wallKeys) wallKeys.add(surfCell.cellIndex);
            wallCount++;
            count++;

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

        this.#profiler.setValue('surfaceColumnsScanned', surface.length);
        this.#profiler.setValue('surfaceColumnsKept', byDepth[0].length);
        this.#profiler.setValue('wallColumns', wallCount);
        this.#profiler.setValue('emittedCells', count);
        this.#profiler.recordSince('membershipCollect', startedAt);

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

        if (cell.depth === 0) return true;

        const c = this.#centroid(cell);
        const s = nx * c.x + ny * c.y + nz * c.z + k;

        return s <= this.#wallBandDist;
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
