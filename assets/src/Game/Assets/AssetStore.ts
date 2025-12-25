import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'

export class AssetStore<T extends SpriteInterface> {
  private assets: Map<number, T> = new Map()

  public add(asset: T): T {
    this.assets.set(asset.getId(), asset)

    return asset
  }

  public get(id: number): T {
    const sprite: T|undefined = this.assets.get(id)

    if (sprite == undefined) {
      throw new Error(`Asset not found: ${id}`)
    }

    return sprite
  }
}
