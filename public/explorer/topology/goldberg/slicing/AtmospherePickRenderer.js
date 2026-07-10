import * as THREE from 'three';
import { buildMergedMesh } from './buildMergedMesh.js';

// Lazily maintains the invisible atmosphere pick shell. The shell uses a
// colorWrite:false / depthWrite:false material so only its geometry exists for
// raycasting — nothing is painted. Because picking is skipped while the view is
// moving, rebuilding the whole-hemisphere shell on every throttled cut advance
// was pure waste. Instead, markDirty() records the new cut and ensure() (called
// by the picker before it raycasts) rebuilds at most once, after motion settles.
export class AtmospherePickRenderer
{
    #sliceGroup;
    #cellGrid;
    #geometryFactory;
    #collector;
    #atmosphereMesh  = null;
    #atmosphereDirty = false;
    #lastN           = new THREE.Vector3();
    #lastK           = 0;
    #pickMaterial;

    constructor({ sliceGroup, cellGrid, geometryFactory, collector })
    {
        this.#sliceGroup      = sliceGroup;
        this.#cellGrid        = cellGrid;
        this.#geometryFactory = geometryFactory;
        this.#collector       = collector;

        this.#pickMaterial = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
        });
    }

    // The live atmosphere pick mesh; null until the first ensure() call.
    get mesh() { return this.#atmosphereMesh; }

    // Record the new cut and flag the shell dirty. Does NOT rebuild — the rebuild
    // is deferred to the next ensure() call so the advance path stays cheap.
    markDirty(n, k)
    {
        this.#lastN.copy(n);
        this.#lastK           = k;
        this.#atmosphereDirty = true;
    }

    // Rebuild the shell if dirty. Returns true when a rebuild happened so the
    // caller knows to refresh capMeshes. Idempotent — safe to call every frame.
    ensure()
    {
        if (!this.#atmosphereDirty) return false;

        this.#atmosphereDirty = false;

        this.#clearMesh();

        const n        = this.#lastN;
        const k        = this.#lastK;
        const included = [];

        for (const cell of this.#cellGrid.atmosphereCells)
        {
            if (this.#collector.included(cell, n, k)) included.push(cell);
        }

        this.#emit(included);

        return true;
    }

    // Dispose the mesh without destroying the pick material (called on each
    // disposeAll cycle — the material is reused across rebuilds).
    clearMesh()
    {
        this.#clearMesh();
        this.#atmosphereDirty = false;
    }

    // Full teardown: dispose mesh and the permanently-owned pick material.
    dispose()
    {
        this.#clearMesh();
        this.#pickMaterial.dispose();
        this.#atmosphereDirty = false;
    }

    #clearMesh()
    {
        if (!this.#atmosphereMesh) return;

        this.#sliceGroup.remove(this.#atmosphereMesh);
        this.#atmosphereMesh.geometry.dispose();
        this.#atmosphereMesh = null;
    }

    #emit(cells)
    {
        if (cells.length === 0) return;

        const mesh = buildMergedMesh(cells, this.#pickMaterial, this.#geometryFactory);

        this.#sliceGroup.add(mesh);
        this.#atmosphereMesh = mesh;
    }
}
