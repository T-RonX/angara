import * as THREE from 'three';
import { TileDataTexture } from '../texture/TileDataTexture.js';
import { createProceduralSurfaceMaterial } from './ProceduralSurfaceMaterial.js';

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
    coreSkirtMaterial;  // flat washer filling the core↔crust seam in the cut plane

    #textureLoader;
    #textures = [];     // loaded textures to dispose
    #tileTexture;
    #disposed = false;

    constructor(body, layerModel, materialConfig, tileData, terrainField)
    {
        this.#textureLoader = new THREE.TextureLoader();

        const maps = this.#loadOptional(body.layerTextures);
        const normals = this.#loadOptional(body.layerNormalMaps);

        this.#tileTexture = new TileDataTexture(tileData, body.terrain.textureWidth);
        this.depthMaterials = layerModel.depthColors.map((c, d) => d === 0
            ? createProceduralSurfaceMaterial({
                body,
                baseColor: c,
                materialConfig,
                tileTexture: this.#tileTexture,
                terrainField,
            })
            : this.#buildDepthMaterial(c, d, maps[d], normals[d], materialConfig));

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

        // The seam-filling skirt sits in the cut plane, just BEHIND the cliff
        // faces (positive polygonOffset) so real cells occlude it and it only
        // shows through the gaps. Colour is per-body configurable; null derives
        // a very dark tone from the body's own palette.
        this.coreSkirtMaterial = new THREE.MeshStandardMaterial({
            color: this.#resolveSkirtColor(body, layerModel),
            roughness: materialConfig.coreRoughness,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: materialConfig.coreCapOffsetFactor + 1,
            polygonOffsetUnits: materialConfig.coreCapOffsetUnits + 1,
        });
    }

    // Configured skirt colour, or an auto very-dark tone: the average of the
    // depth colours and the core colour, scaled hard toward black so the seam
    // reads as an unobtrusive dark fill compatible with the body's palette.
    #resolveSkirtColor(body, layerModel)
    {
        const configured = body.coreSkirt?.color;

        if (configured !== null && configured !== undefined)
        {
            return configured;
        }

        const acc = new THREE.Color(0, 0, 0);
        const sources = [...layerModel.depthColors, body.coreColor];

        for (const c of sources) acc.add(new THREE.Color(c));

        acc.multiplyScalar(1 / sources.length);
        acc.multiplyScalar(0.18);

        return acc;
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
        this.coreSkirtMaterial.dispose();

        for (const t of this.#textures) t.dispose();
        this.#tileTexture.dispose();

        this.#textures.length = 0;
    }
}
