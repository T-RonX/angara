import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import type { SpriteFactory } from '@/Renderer/Sprite/SpriteFactory'

export abstract class AbstractSpriteGenerator {
  protected spriteType: SpriteType
  protected factory: SpriteFactory|null = null

  constructor(spriteType: SpriteType) {
    this.spriteType = spriteType
  }

  public getSpriteType(): SpriteType {
    return this.spriteType
  }

  public setFactory(factory: SpriteFactory): this {
    this.factory = factory

    return this
  }

  public getFactory(): SpriteFactory {
    if (this.factory === null) {
      throw new Error('No factory set.')
    }

    return this.factory
  }
}
