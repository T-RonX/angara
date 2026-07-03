import * as THREE from 'three';

// ----------------------------------------------------------------------
// LayerMaterialFactory — the single place that decides what the VISIBLE
// faces of the body look like. Today it returns flat-shaded colours, but
// it already reads the (reserved) `layerTextures` / `layerNormalMaps`
// slots from the planet config, so skinning the crust later is a
// data-only change: drop URLs into the config and the faces get textured
// with no call-site edits.
// ----------------------------------------------------------------------
export class LayerMaterialFactory
{
    depthMaterials;     // one per crust depth (the lit body shells)
    capMaterials;       // one per depth for the sliced cross-section caps
    coreMaterial;       // the inner core sphere
    coreCapMaterial;    // the core's flat cut cap
    atmosphereCapMaterial; // near-invisible atmosphere cross-section strip

    #textureLoader;

    constructor(planet, layerModel)
    {
        this.#textureLoader = new THREE.TextureLoader();

        const maps = this.#loadOptional(planet.layerTextures);
        const normals = this.#loadOptional(planet.layerNormalMaps);

        this.depthMaterials = layerModel.depthColors.map((c, d) =>
            this.#buildDepthMaterial(c, d, maps[d], normals[d]));

        this.capMaterials = layerModel.depthColors.map(c => new THREE.MeshStandardMaterial({
            color: new THREE.Color(c).multiplyScalar(0.85),
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
            // Win the depth test against the clipped surface at the cut seam
            // with a depth-only bias (no geometric lift).
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        }));

        this.coreMaterial = new THREE.MeshStandardMaterial({
            color: planet.coreColor, roughness: 1, side: THREE.DoubleSide,
        });

        this.coreCapMaterial = new THREE.MeshStandardMaterial({
            color: planet.coreColor, roughness: 1, side: THREE.DoubleSide,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });

        this.atmosphereCapMaterial = new THREE.MeshBasicMaterial({
            color: 0x9fd0ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
            depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
    }

    #buildDepthMaterial(color, depth, map, normalMap)
    {
        const mat = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.95,
            metalness: 0.0,
            // Single-sided: coincident walls of touching cells have opposite
            // normals, so back-face culling leaves only one — no z-fighting.
            side: THREE.FrontSide,
            // Deeper layers are slightly emissive so the cross-section reads.
            emissive: new THREE.Color(color).multiplyScalar(0.06 * depth),
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

        return urls.map(url => (url ? this.#textureLoader.load(url) : null));
    }
}

