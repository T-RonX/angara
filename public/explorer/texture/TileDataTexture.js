import * as THREE from 'three';

export class TileDataTexture
{
    texture;
    width;
    height;
    count;

    #disposed = false;

    constructor(tileData, preferredWidth)
    {
        this.count = tileData.count;
        this.width = Math.min(preferredWidth, Math.max(1, this.count));
        this.height = Math.max(1, Math.ceil(this.count / this.width));
        const data = new Float32Array(this.width * this.height * 4);
        data.set(tileData.packed);

        this.texture = new THREE.DataTexture(
            data,
            this.width,
            this.height,
            THREE.RGBAFormat,
            THREE.FloatType,
        );
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.generateMipmaps = false;
        this.texture.needsUpdate = true;
    }

    dispose()
    {
        if (this.#disposed) return;

        this.#disposed = true;
        this.texture.dispose();
    }
}
