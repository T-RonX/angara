import * as THREE from 'three';
import { buildMergedMesh, updateMergedMesh } from './buildMergedMesh.js';
import { CELL_GEOMETRY_VARIANT } from '../../../geometry/CellGeometryFactory.js';

// Owns the opaque continuous slice: one immutable surface atlas with a dynamic
// index, plus one retained full-prism stream per depth when first needed.
export class PersistentSliceMeshStore
{
    #sliceGroup;
    #materials;
    #geometryFactory;
    #cellsByDepth;
    #profiler;
    #surfaceMesh = null;
    #surfaceSourceIndices;
    #surfaceIndexOffsets;
    #surfaceIndexCounts;
    #streamMeshes;
    #fixedSpheres = null;
    #activeMeshes = [];
    #disposed = false;

    constructor({ sliceGroup, materials, geometryFactory, cellsByDepth, profiler })
    {
        this.#sliceGroup = sliceGroup;
        this.#materials = materials;
        this.#geometryFactory = geometryFactory;
        this.#cellsByDepth = cellsByDepth;
        this.#profiler = profiler;
        this.#streamMeshes = new Array(cellsByDepth.length).fill(null);
    }

    get activeMeshes() { return this.#activeMeshes; }
    get surfaceMesh() { return this.#surfaceMesh; }
    get streamMeshes() { return this.#streamMeshes; }

    ensureInitialized()
    {
        if (this.#disposed || this.#surfaceMesh) return;

        this.#surfaceMesh = this.#buildSurfaceAtlas(this.#cellsByDepth[0]);
        const bodyRadius = this.#surfaceMesh.geometry.boundingSphere.radius;

        this.#fixedSpheres = this.#cellsByDepth.map(
            () => new THREE.Sphere(new THREE.Vector3(), bodyRadius),
        );
        this.#sliceGroup.add(this.#surfaceMesh);
        this.#profiler.increment('persistentMeshAllocations');
    }

    sync(byDepth, wallSurface, { updateSurface = true } = {})
    {
        if (this.#disposed) return;

        this.ensureInitialized();

        const startedAt = this.#profiler.now();
        if (updateSurface) this.#updateSurface(byDepth[0] ?? []);

        const wallStartedAt = this.#profiler.now();
        let streamedCells = 0;
        let streamedVertices = 0;
        let streamedTriangles = 0;

        for (let depth = 0; depth < this.#streamMeshes.length; depth++)
        {
            const cells = depth === 0 ? wallSurface : (byDepth[depth] ?? []);
            const stats = this.#updateStream(depth, cells);

            streamedCells += cells.length;
            streamedVertices += stats.vertices;
            streamedTriangles += stats.triangles;
        }

        this.#activeMeshes.length = 0;

        if (this.#surfaceMesh.visible) this.#activeMeshes.push(this.#surfaceMesh);

        for (const mesh of this.#streamMeshes)
        {
            if (mesh?.visible) this.#activeMeshes.push(mesh);
        }

        this.#profiler.recordSince('wallStreamUpdate', wallStartedAt);
        this.#profiler.recordSince('sliceMeshSync', startedAt);
        this.#profiler.setValue('activePersistentMeshes', this.#activeMeshes.length);
        this.#profiler.setValue('streamedCells', streamedCells);
        this.#profiler.setValue('streamedVertices', streamedVertices);
        this.#profiler.setValue('streamedTriangles', streamedTriangles);
    }

    clear()
    {
        if (this.#disposed || !this.#surfaceMesh) return;

        this.sync(this.#cellsByDepth.map(() => []), []);
    }

    dispose()
    {
        if (this.#disposed) return;

        this.#disposed = true;
        if (this.#surfaceMesh) this.#disposeMesh(this.#surfaceMesh);

        for (const mesh of this.#streamMeshes)
        {
            if (mesh) this.#disposeMesh(mesh);
        }

        this.#streamMeshes.fill(null);
        this.#activeMeshes.length = 0;
        this.#surfaceMesh = null;
        this.#fixedSpheres = null;
    }

    #buildSurfaceAtlas(surfaceCells)
    {
        const positions = [];
        const normals = [];
        const sourceIndices = [];
        let maxCellIndex = 0;

        for (const cell of surfaceCells) maxCellIndex = Math.max(maxCellIndex, cell.cellIndex);

        this.#surfaceIndexOffsets = new Uint32Array(maxCellIndex + 1);
        this.#surfaceIndexCounts = new Uint8Array(maxCellIndex + 1);

        for (const cell of surfaceCells)
        {
            const offset = sourceIndices.length;

            this.#geometryFactory.appendOuterFace(cell, positions, normals, sourceIndices);
            this.#surfaceIndexOffsets[cell.cellIndex] = offset;
            this.#surfaceIndexCounts[cell.cellIndex] = sourceIndices.length - offset;
        }

        this.#surfaceSourceIndices = new Uint32Array(sourceIndices);

        const geometry = new THREE.BufferGeometry();
        const position = new THREE.BufferAttribute(new Float32Array(positions), 3);
        const normal = new THREE.BufferAttribute(new Float32Array(normals), 3);
        const index = new THREE.BufferAttribute(
            new Uint32Array(this.#surfaceSourceIndices.length),
            1,
        );

        index.setUsage(THREE.DynamicDrawUsage);
        index.count = 0;
        geometry.setAttribute('position', position);
        geometry.setAttribute('normal', normal);
        geometry.setIndex(index);
        geometry.setDrawRange(0, 0);
        geometry.boundingSphere = this.#sphereForPositions(position.array);

        const mesh = new THREE.Mesh(geometry, this.#materials.depthMaterials[0]);

        mesh.userData.faceToCell = [];
        mesh.matrixAutoUpdate = false;
        mesh.visible = false;
        mesh.updateMatrix();

        return mesh;
    }

    #updateSurface(cells)
    {
        const startedAt = this.#profiler.now();
        const geometry = this.#surfaceMesh.geometry;
        const index = geometry.index;
        const target = index.array;
        const faceToCell = this.#surfaceMesh.userData.faceToCell;
        let indexOffset = 0;
        let faceOffset = 0;

        this.#invalidateBoundsTree(geometry);

        for (const cell of cells)
        {
            const sourceOffset = this.#surfaceIndexOffsets[cell.cellIndex];
            const count = this.#surfaceIndexCounts[cell.cellIndex];

            for (let i = 0; i < count; i++)
            {
                target[indexOffset + i] = this.#surfaceSourceIndices[sourceOffset + i];
            }

            const faceCount = count / 3;

            for (let face = 0; face < faceCount; face++)
            {
                faceToCell[faceOffset + face] = cell;
            }

            indexOffset += count;
            faceOffset += faceCount;
        }

        faceToCell.length = faceOffset;
        index.count = indexOffset;
        geometry.setDrawRange(0, indexOffset);
        this.#markUpdated(index, indexOffset);
        this.#surfaceMesh.visible = indexOffset > 0;
        this.#profiler.recordSince('surfaceIndexUpdate', startedAt);
        this.#profiler.setValue('surfaceCells', cells.length);
        this.#profiler.setValue('surfaceIndices', indexOffset);
    }

    #updateStream(depth, cells)
    {
        let mesh = this.#streamMeshes[depth];

        if (!mesh && cells.length > 0)
        {
            mesh = buildMergedMesh(
                cells,
                this.#materials.depthMaterials[depth],
                this.#geometryFactory,
                this.#profiler,
                {
                    variant: depth === 0
                        ? CELL_GEOMETRY_VARIANT.NO_OUTER
                        : CELL_GEOMETRY_VARIANT.FULL,
                    metricScope: 'persistentStream',
                },
            );
            this.#makeDynamic(mesh.geometry);
            mesh.geometry.boundingBox = null;
            mesh.geometry.boundingSphere = this.#fixedSpheres[depth];
            this.#sliceGroup.add(mesh);
            this.#streamMeshes[depth] = mesh;
            this.#profiler.increment('persistentMeshAllocations');
        }
        else if (mesh)
        {
            updateMergedMesh(
                mesh,
                cells,
                this.#geometryFactory,
                this.#profiler,
                {
                    boundingSphere: this.#fixedSpheres[depth],
                    dynamicDraw: true,
                    variant: depth === 0
                        ? CELL_GEOMETRY_VARIANT.NO_OUTER
                        : CELL_GEOMETRY_VARIANT.FULL,
                    metricScope: 'persistentStream',
                },
            );
        }

        if (!mesh) return { vertices: 0, triangles: 0 };

        mesh.visible = cells.length > 0;

        return {
            vertices: mesh.geometry.getAttribute('position').count,
            triangles: mesh.geometry.index.count / 3,
        };
    }

    #makeDynamic(geometry)
    {
        geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
        geometry.getAttribute('normal').setUsage(THREE.DynamicDrawUsage);
        geometry.index.setUsage(THREE.DynamicDrawUsage);
    }

    #sphereForPositions(positions)
    {
        let radius = 0;

        for (let i = 0; i < positions.length; i += 3)
        {
            radius = Math.max(
                radius,
                Math.hypot(positions[i], positions[i + 1], positions[i + 2]),
            );
        }

        return new THREE.Sphere(new THREE.Vector3(), radius);
    }

    #invalidateBoundsTree(geometry)
    {
        if (!geometry.boundsTree) return;

        if (typeof geometry.disposeBoundsTree !== 'function')
        {
            throw new Error('[PersistentSliceMeshStore] Cannot invalidate slice BVH');
        }

        geometry.disposeBoundsTree();
    }

    #markUpdated(attribute, activeCount)
    {
        if (
            typeof attribute.clearUpdateRanges === 'function'
            && typeof attribute.addUpdateRange === 'function'
        )
        {
            attribute.clearUpdateRanges();
            attribute.addUpdateRange(0, activeCount);
        }
        else if (attribute.updateRange)
        {
            attribute.updateRange.offset = 0;
            attribute.updateRange.count = activeCount;
        }

        attribute.needsUpdate = true;
    }

    #disposeMesh(mesh)
    {
        this.#invalidateBoundsTree(mesh.geometry);
        this.#sliceGroup.remove(mesh);
        mesh.geometry.dispose();
    }
}
