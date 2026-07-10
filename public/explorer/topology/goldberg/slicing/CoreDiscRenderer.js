import * as THREE from 'three';

// Renders the solid core cut-face disc that fills the GPU-clipped core sphere's
// opening at the cut plane. The disc is rebuilt every cut advance (it is visible
// and must track the plane). No layered backing is needed — the crust is a solid
// stack of whole cells over the kept hemisphere that already occludes the far
// side and empty space behind the wall.
export class CoreDiscRenderer
{
    #sliceGroup;
    #layerModel;
    #materials;
    #staticTransient = [];

    constructor({ sliceGroup, layerModel, materials })
    {
        this.#sliceGroup  = sliceGroup;
        this.#layerModel  = layerModel;
        this.#materials   = materials;
    }

    // Live array of transient disc meshes for inclusion in capMeshes (they act
    // as depth blockers for the picker — no faceToCell so non-pickable).
    get meshes() { return this.#staticTransient; }

    // Dispose the current disc and emit a fresh one for the new cut.
    rebuild(n, k)
    {
        this.clear();
        this.#emitDisc(n, k);
    }

    // Dispose all transient disc meshes without rebuilding.
    clear()
    {
        for (const m of this.#staticTransient)
        {
            this.#sliceGroup.remove(m);
            m.geometry.dispose();
        }

        this.#staticTransient.length = 0;
    }

    // Full teardown — same as clear (the coreCapMaterial is owned by materials,
    // not by this renderer).
    dispose()
    {
        this.clear();
    }

    #emitDisc(n, k)
    {
        const coreR = this.#layerModel.coreRadius;
        const v     = coreR * coreR - k * k;

        if (v <= 1e-8) return;

        const discR   = Math.sqrt(v);
        const discGeo = new THREE.CircleGeometry(discR, 96);
        const disc    = new THREE.Mesh(discGeo, this.#materials.coreCapMaterial);

        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        disc.position.copy(n).multiplyScalar(-k);
        disc.matrixAutoUpdate = false;
        disc.updateMatrix();

        this.#sliceGroup.add(disc);
        this.#staticTransient.push(disc);
    }
}
