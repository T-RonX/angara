import * as THREE from 'three';
import { CELL_GEOMETRY_VARIANT } from '../../../geometry/CellGeometryFactory.js';

// Build or update one merged mesh from cached per-cell typed arrays.
export function buildMergedMesh(
    cells,
    material,
    geometryFactory,
    profiler = null,
    options = {},
)
{
    const profiling = profiler?.enabled ?? false;
    const startedAt = profiling ? performance.now() : 0;
    const variant = options.variant ?? CELL_GEOMETRY_VARIANT.FULL;
    const size = measure(cells, geometryFactory, variant);
    const sizedAt = profiling ? performance.now() : 0;
    const geo = new THREE.BufferGeometry();

    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(size.floatCount), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(size.floatCount), 3));
    geo.setAttribute('tileId', new THREE.BufferAttribute(new Float32Array(size.vertexCount), 1));
    geo.setAttribute('outwardFace', new THREE.BufferAttribute(new Float32Array(size.vertexCount), 1));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(size.idxCount), 1));

    const faceToCell = new Array(size.idxCount / 3);

    fill(
        geo,
        faceToCell,
        cells,
        geometryFactory,
        size,
        false,
        variant,
    );

    const assembledAt = profiling ? performance.now() : 0;

    finalizeBounds(geo);

    const mesh = new THREE.Mesh(geo, material);

    mesh.userData.faceToCell = faceToCell;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();

    recordMetrics(
        profiler,
        profiling,
        startedAt,
        sizedAt,
        assembledAt,
        cells.length,
        size,
        options.metricScope,
    );

    return mesh;
}

// Returns active geometry counts when the existing geometry can be safely
// rewritten, otherwise null so its owner can replace only that mesh entry.
export function updateMergedMesh(
    mesh,
    cells,
    geometryFactory,
    profiler = null,
    options = {},
)
{
    const geo = mesh?.geometry;
    const position = geo?.getAttribute('position');
    const normal = geo?.getAttribute('normal');
    const tileId = geo?.getAttribute('tileId');
    const outwardFace = geo?.getAttribute('outwardFace');
    const index = geo?.index;

    if (
        !geo
        || !(position?.array instanceof Float32Array)
        || !(normal?.array instanceof Float32Array)
        || !(index?.array instanceof Uint32Array)
        || !(tileId?.array instanceof Float32Array)
        || !(outwardFace?.array instanceof Float32Array)
        || position.itemSize !== 3
        || normal.itemSize !== 3
        || index.itemSize !== 1
        || tileId.itemSize !== 1
        || outwardFace.itemSize !== 1
    )
    {
        return null;
    }

    if (geo.boundsTree && typeof geo.disposeBoundsTree !== 'function') return null;

    const profiling = profiler?.enabled ?? false;
    const startedAt = profiling ? performance.now() : 0;
    const variant = options.variant ?? CELL_GEOMETRY_VARIANT.FULL;
    const size = measure(cells, geometryFactory, variant);
    const sizedAt = profiling ? performance.now() : 0;

    if (geo.boundsTree) geo.disposeBoundsTree();

    const grew = ensureCapacity(geo, size, options.dynamicDraw ?? false);

    let faceToCell = mesh.userData.faceToCell;

    if (!Array.isArray(faceToCell))
    {
        faceToCell = [];
        mesh.userData.faceToCell = faceToCell;
    }

    fill(
        geo,
        faceToCell,
        cells,
        geometryFactory,
        size,
        true,
        variant,
    );

    const assembledAt = profiling ? performance.now() : 0;

    if (options.boundingSphere)
    {
        geo.boundingBox = null;
        geo.boundingSphere = options.boundingSphere;
    }
    else
    {
        finalizeBounds(geo);
    }

    recordMetrics(
        profiler,
        profiling,
        startedAt,
        sizedAt,
        assembledAt,
        cells.length,
        size,
        options.metricScope,
    );

    if (grew && profiling && options.metricScope === 'persistentStream')
    {
        profiler.increment('persistentStreamCapacityGrowths');
    }

    return {
        vertices: size.floatCount / 3,
        triangles: size.idxCount / 3,
    };
}

function measure(cells, geometryFactory, variant)
{
    let floatCount = 0;
    let idxCount = 0;

    for (const cell of cells)
    {
        const g = geometryFactory.cellArrays(cell, variant);

        floatCount += g.pos.length;
        idxCount += g.idx.length;
    }

    return { floatCount, vertexCount: floatCount / 3, idxCount };
}

function fill(
    geo,
    faceToCell,
    cells,
    geometryFactory,
    size,
    markForUpload,
    variant,
)
{
    const position = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const index = geo.index;
    const tileId = geo.getAttribute('tileId');
    const outwardFace = geo.getAttribute('outwardFace');
    const positions = position.array;
    const normals = normal.array;
    const indices = index.array;
    const tileIds = tileId.array;
    const outwardFaces = outwardFace.array;
    let floatOff = 0;
    let idxOff = 0;
    let vertBase = 0;
    let faceOff = 0;

    for (const cell of cells)
    {
        const g = geometryFactory.cellArrays(cell, variant);

        positions.set(g.pos, floatOff);
        normals.set(g.nrm, floatOff);
        tileIds.set(g.tileId, vertBase);
        outwardFaces.set(g.outwardFace, vertBase);

        for (let j = 0; j < g.idx.length; j++)
        {
            indices[idxOff + j] = vertBase + g.idx[j];
        }

        const innerStart = g.innerFaceTriStart;
        const innerEnd = innerStart + g.innerFaceTriCount;

        for (let t = 0; t < g.triCount; t++)
        {
            faceToCell[faceOff + t] = t >= innerStart && t < innerEnd ? null : cell;
        }

        floatOff += g.pos.length;
        idxOff += g.idx.length;
        vertBase += g.pos.length / 3;
        faceOff += g.triCount;
    }

    faceToCell.length = faceOff;
    position.count = size.floatCount / 3;
    normal.count = size.floatCount / 3;
    index.count = size.idxCount;
    tileId.count = size.vertexCount;
    outwardFace.count = size.vertexCount;
    geo.setDrawRange(0, size.idxCount);

    if (markForUpload)
    {
        markUpdated(position, size.floatCount);
        markUpdated(normal, size.floatCount);
        markUpdated(index, size.idxCount);
        markUpdated(tileId, size.vertexCount);
        markUpdated(outwardFace, size.vertexCount);
    }
}

function ensureCapacity(geo, size, dynamicDraw)
{
    const position = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const index = geo.index;
    const tileId = geo.getAttribute('tileId');
    const outwardFace = geo.getAttribute('outwardFace');
    const growFloats = position.array.length < size.floatCount
        || normal.array.length < size.floatCount;
    const growVertices = tileId.array.length < size.vertexCount
        || outwardFace.array.length < size.vertexCount;
    const growIndices = index.array.length < size.idxCount;

    if (!growFloats && !growVertices && !growIndices) return false;

    // Three r160's renderer releases uploaded BufferAttributes only from the
    // geometry dispose event. Keep the geometry identity, but release every
    // currently attached GPU buffer before replacing any growing attribute.
    geo.dispose();

    if (growFloats)
    {
        const current = Math.min(position.array.length, normal.array.length);
        const capacity = grownCapacity(current, size.floatCount, 3);
        const nextPosition = new THREE.BufferAttribute(new Float32Array(capacity), 3);
        const nextNormal = new THREE.BufferAttribute(new Float32Array(capacity), 3);

        if (dynamicDraw)
        {
            nextPosition.setUsage(THREE.DynamicDrawUsage);
            nextNormal.setUsage(THREE.DynamicDrawUsage);
        }

        geo.setAttribute('position', nextPosition);
        geo.setAttribute('normal', nextNormal);
    }

    if (growVertices)
    {
        const current = Math.min(tileId.array.length, outwardFace.array.length);
        const capacity = grownCapacity(current, size.vertexCount, 1);
        const nextTileId = new THREE.BufferAttribute(new Float32Array(capacity), 1);
        const nextOutwardFace = new THREE.BufferAttribute(new Float32Array(capacity), 1);

        if (dynamicDraw)
        {
            nextTileId.setUsage(THREE.DynamicDrawUsage);
            nextOutwardFace.setUsage(THREE.DynamicDrawUsage);
        }

        geo.setAttribute('tileId', nextTileId);
        geo.setAttribute('outwardFace', nextOutwardFace);
    }

    if (growIndices)
    {
        const capacity = grownCapacity(index.array.length, size.idxCount, 3);
        const nextIndex = new THREE.BufferAttribute(new Uint32Array(capacity), 1);

        if (dynamicDraw) nextIndex.setUsage(THREE.DynamicDrawUsage);

        geo.setIndex(nextIndex);
    }

    return true;
}

function grownCapacity(current, required, multiple)
{
    const geometric = current > 0 ? Math.ceil(current * 1.5) : required;

    return Math.ceil(Math.max(required, geometric) / multiple) * multiple;
}

function markUpdated(attribute, activeComponentCount)
{
    if (
        typeof attribute.clearUpdateRanges === 'function'
        && typeof attribute.addUpdateRange === 'function'
    )
    {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, activeComponentCount);
    }
    else if (attribute.updateRange)
    {
        attribute.updateRange.offset = 0;
        attribute.updateRange.count = activeComponentCount;
    }

    attribute.needsUpdate = true;
}

function finalizeBounds(geo)
{
    geo.boundingBox = null;
    geo.boundingSphere = null;
    geo.computeBoundingSphere();
}

function recordMetrics(
    profiler,
    profiling,
    startedAt,
    sizedAt,
    assembledAt,
    cellCount,
    size,
    metricScope = 'transient',
)
{
    if (!profiling) return;

    const finishedAt = performance.now();
    const prefix = metricScope === 'persistentStream'
        ? 'persistentStreamMerged'
        : 'transientMerged';

    profiler.recordTiming(`${prefix}Sizing`, sizedAt - startedAt);
    profiler.recordTiming(`${prefix}Assembly`, assembledAt - sizedAt);
    profiler.recordTiming(`${prefix}Finalize`, finishedAt - assembledAt);
    profiler.recordTiming(`${prefix}Total`, finishedAt - startedAt);
    profiler.increment(`${prefix}Meshes`);
    profiler.increment(`${prefix}Cells`, cellCount);
    profiler.increment(`${prefix}Vertices`, size.floatCount / 3);
    profiler.increment(`${prefix}Triangles`, size.idxCount / 3);
}
