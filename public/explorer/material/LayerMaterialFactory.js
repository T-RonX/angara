import * as THREE from 'three';

// ----------------------------------------------------------------------
// LayerMaterialFactory — the single place that decides what the VISIBLE
// faces of the body look like. Today it returns flat-shaded colours, but
// it already reads the (reserved) `layerTextures` / `layerNormalMaps`
// slots from the body config, so skinning the crust later is a
// data-only change: drop URLs into the config and the faces get textured
// with no call-site edits.
// ----------------------------------------------------------------------
export class LayerMaterialFactory
{
    depthMaterials;     // one per crust depth (the lit body shells)
    coreMaterial;       // the inner core sphere
    coreCapMaterial;    // the core's flat cut cap

    #textureLoader;
    #textures = [];     // loaded textures to dispose
    #disposed = false;

    constructor(body, layerModel, materialConfig)
    {
        this.#textureLoader = new THREE.TextureLoader();

        const maps = this.#loadOptional(body.layerTextures);
        const normals = this.#loadOptional(body.layerNormalMaps);

        this.depthMaterials = layerModel.depthColors.map((c, d) =>
            this.#buildDepthMaterial(c, d, maps[d], normals[d], materialConfig));

        this.coreMaterial = new THREE.MeshStandardMaterial({
            color: body.coreColor,
            roughness: materialConfig.coreRoughness,
            side: THREE.DoubleSide,
        });

        this.coreCapMaterial = new THREE.MeshStandardMaterial({
            color: body.coreColor,
            roughness: materialConfig.coreRoughness,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: materialConfig.coreCapOffsetFactor,
            polygonOffsetUnits: materialConfig.coreCapOffsetUnits,
        });
    }

    #buildDepthMaterial(color, depth, map, normalMap, materialConfig)
    {
        const mat = new THREE.MeshStandardMaterial({
            color,
            roughness: materialConfig.roughness,
            metalness: materialConfig.metalness,
            // Single-sided: coincident walls of touching cells have opposite
            // normals, so back-face culling leaves only one — no z-fighting.
            side: THREE.FrontSide,
            // Deeper layers are slightly emissive so the cross-section reads.
            emissive: new THREE.Color(color).multiplyScalar(materialConfig.emissiveScale * depth),
        });

        // Reserved texturing seam — only takes effect once the config slots
        // are populated.
        if (map)       mat.map = map;
        if (normalMap) mat.normalMap = normalMap;

        return mat;
    }

    // Load an optional array of texture URLs (null entries stay null).
    #loadOptional(urls)
    {
        if (!Array.isArray(urls))
        {
            return [];
        }

        return urls.map(url =>
        {
            if (!url) return null;

            const tex = this.#textureLoader.load(url);
            this.#textures.push(tex);

            return tex;
        });
    }

    // Dispose all owned materials and loaded textures. Idempotent.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const m of this.depthMaterials) m.dispose();

        this.coreMaterial.dispose();
        this.coreCapMaterial.dispose();

        for (const t of this.#textures) t.dispose();

        this.#textures.length = 0;
    }
}
