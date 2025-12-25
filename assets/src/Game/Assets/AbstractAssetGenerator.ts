import type { AssetFactory } from '@/Game/Assets/AssetFactory'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'

export abstract class AbstractAssetGenerator extends AbstractSpriteGenerator {
  protected factory: AssetFactory|null = null

  public setFactory(factory: AssetFactory): this {
    this.factory = factory

    return this
  }

  public getFactory(): AssetFactory {
    if (this.factory === null) {
      throw new Error('No factory set.')
    }

    return this.factory
  }

  public reset(): void {
  }
}