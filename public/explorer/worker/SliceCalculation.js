// Dependency-free column membership calculation shared by the slice worker and
// Node parity tests. Snapshot arrays are treated as read-only.

function visibleAt(columnIndex, columnBounds, frustumPlanes)
{
    if (!frustumPlanes) return true;

    const offset = columnIndex * 4;
    const x = columnBounds[offset];
    const y = columnBounds[offset + 1];
    const z = columnBounds[offset + 2];
    const radius = columnBounds[offset + 3];

    for (let plane = 0; plane < frustumPlanes.length; plane += 4)
    {
        const distance = frustumPlanes[plane] * x
            + frustumPlanes[plane + 1] * y
            + frustumPlanes[plane + 2] * z
            + frustumPlanes[plane + 3];
        const tolerance = 1e-9 * Math.max(1, radius, Math.abs(distance));

        if (distance < -radius - tolerance) return false;
    }

    return true;
}

function finaliseResult({
    surfaceColumns,
    wallCandidateColumns,
    wallColumns,
    surfaceHash,
    wallHash,
    maxDepth,
    cellStride,
    stats,
})
{
    return {
        surfaceColumns: Uint32Array.from(surfaceColumns),
        wallCandidateColumns: Uint32Array.from(wallCandidateColumns),
        wallColumns: Uint32Array.from(wallColumns),
        surfaceHash,
        cellStride,
        count: surfaceColumns.length + wallColumns.length * maxDepth,
        hash: (Math.imul(surfaceHash, 31) + wallHash) >>> 0,
        ...stats,
    };
}

function collectSlice(snapshot, {
    normal,
    constant,
    eps,
    maxDepth,
    cellStride,
    wallBandDist,
    applyViewCull = true,
    frustumPlanes = null,
    measure = false,
})
{
    const {
        cornerCoordinates,
        cornerOffsets,
        centroidCoordinates,
        cornerRadii,
        columnBounds,
    } = snapshot;
    const surfaceColumns = [];
    const wallCandidateColumns = [];
    const wallColumns = [];
    let surfaceHash = 0;
    let wallHash = 0;
    let boundsRejected = 0;
    let boundsAccepted = 0;
    let exactTested = 0;
    let cornerTests = 0;
    const profile = measure === true;
    const nx = normal[0];
    const ny = normal[1];
    const nz = normal[2];
    const normalLength = Math.hypot(nx, ny, nz);
    const columnCount = centroidCoordinates.length / 3;

    for (let column = 0; column < columnCount; column++)
    {
        const centroidOffset = column * 3;
        const centroidDistance = nx * centroidCoordinates[centroidOffset]
            + ny * centroidCoordinates[centroidOffset + 1]
            + nz * centroidCoordinates[centroidOffset + 2]
            + constant;
        const cornerRadius = cornerRadii[column] * normalLength;

        if (centroidDistance < -cornerRadius - eps)
        {
            if (profile) boundsRejected++;

            continue;
        }

        let included = centroidDistance >= cornerRadius - eps;

        if (included && profile) boundsAccepted++;

        if (!included)
        {
            if (profile) exactTested++;

            for (let offset = cornerOffsets[column]; offset < cornerOffsets[column + 1]; offset += 3)
            {
                if (profile) cornerTests++;
                const distance = nx * cornerCoordinates[offset]
                    + ny * cornerCoordinates[offset + 1]
                    + nz * cornerCoordinates[offset + 2]
                    + constant;

                if (distance >= -eps)
                {
                    included = true;

                    break;
                }
            }
        }

        if (!included) continue;

        surfaceColumns.push(column);
        surfaceHash = (Math.imul(surfaceHash, 31) + column) >>> 0;

        if (centroidDistance > wallBandDist) continue;

        wallCandidateColumns.push(column);

        if (applyViewCull && !visibleAt(column, columnBounds, frustumPlanes)) continue;

        wallColumns.push(column);
        wallHash = (Math.imul(wallHash, 31) + column) >>> 0;

        for (let depth = 1; depth < maxDepth; depth++)
        {
            wallHash = (Math.imul(wallHash, 31) + column * (depth + 1)) >>> 0;
        }
    }

    return finaliseResult({
        surfaceColumns,
        wallCandidateColumns,
        wallColumns,
        surfaceHash,
        wallHash,
        maxDepth,
        cellStride,
        stats: profile ? {
            columnsScanned: columnCount,
            boundsRejected,
            boundsAccepted,
            exactTested,
            cornerTests,
        } : {},
    });
}

function refocusSlice({
    surfaceColumns,
    wallCandidateColumns,
    surfaceHash,
}, {
    maxDepth,
    cellStride,
    applyViewCull = true,
    frustumPlanes = null,
    measure = false,
}, snapshot)
{
    const wallColumns = [];
    let wallHash = 0;

    for (const column of wallCandidateColumns)
    {
        if (applyViewCull && !visibleAt(column, snapshot.columnBounds, frustumPlanes)) continue;

        wallColumns.push(column);
        wallHash = (Math.imul(wallHash, 31) + column) >>> 0;

        for (let depth = 1; depth < maxDepth; depth++)
        {
            wallHash = (Math.imul(wallHash, 31) + column * (depth + 1)) >>> 0;
        }
    }

    return finaliseResult({
        surfaceColumns,
        wallCandidateColumns,
        wallColumns,
        surfaceHash,
        wallHash,
        maxDepth,
        cellStride,
        stats: measure === true ? {
            columnsScanned: surfaceColumns.length,
            boundsRejected: 0,
            boundsAccepted: 0,
            exactTested: 0,
            cornerTests: 0,
        } : {},
    });
}

export function calculateSlice(snapshot, request)
{
    if (request.kind === 'refocus')
    {
        return refocusSlice(request.physical, request, snapshot);
    }

    return collectSlice(snapshot, request);
}
