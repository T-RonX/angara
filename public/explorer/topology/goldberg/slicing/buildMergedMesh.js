import * as THREE from 'three';

// Build one merged THREE.Mesh from the cells' CACHED per-cell typed arrays.
// Total vertex/index counts are summed in one pass; a single Float32Array per
// attribute (and one Uint32Array index) is allocated and each cell's cache is
// copied in with .set() at its offset — no intermediate JS arrays and no
// second copy inside a Float32BufferAttribute.
//
// matrixAutoUpdate is off (the slice group never moves). BVH is NOT built
// here — CliffPicker builds it lazily at pick time so this hot rebuild path
// stays cheap during a continuous cut advance.
export function buildMergedMesh(cells, material, geometryFactory)
{
    let floatCount = 0;
    let idxCount   = 0;

    for (const cell of cells)
    {
        const g = geometryFactory.cellArrays(cell);

        floatCount += g.pos.length;
        idxCount   += g.idx.length;
    }

    const positions  = new Float32Array(floatCount);
    const normals    = new Float32Array(floatCount);
    const indices    = new Uint32Array(idxCount);
    const faceToCell = [];

    let floatOff = 0;
    let idxOff   = 0;
    let vertBase = 0;

    for (const cell of cells)
    {
        const g = geometryFactory.cellArrays(cell);

        positions.set(g.pos, floatOff);
        normals.set(g.nrm, floatOff);

        for (let j = 0; j < g.idx.length; j++)
        {
            indices[idxOff + j] = vertBase + g.idx[j];
        }

        // The inner ("bottom", core-facing) fan of each cell is not selectable
        // in resource mode — record `null` for its triangles so CliffPicker
        // treats hits on it as no pick.
        const innerStart = g.innerFaceTriStart;
        const innerEnd   = innerStart + g.innerFaceTriCount;

        for (let t = 0; t < g.triCount; t++)
        {
            faceToCell.push(t >= innerStart && t < innerEnd ? null : cell);
        }

        floatOff += g.pos.length;
        idxOff   += g.idx.length;
        vertBase += g.pos.length / 3;
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);

    mesh.userData.faceToCell = faceToCell;
    mesh.matrixAutoUpdate    = false;
    mesh.updateMatrix();

    return mesh;
}
