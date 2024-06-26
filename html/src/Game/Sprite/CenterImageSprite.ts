import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import { Map } from '@/Game/Map/Map'
import type { StaticImage } from '@/Renderer/Sprite/Type/Image/StaticImage'
import { AbstractAssetGenerator } from '@/Game/Assets/AbstractAssetGenerator'

export class CenterImageSprite extends AbstractAssetGenerator implements SpriteGeneratorInterface {
  private images: StaticImage[] = []

  constructor(spriteType: SpriteType, private map: Map) {
    super(spriteType)
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    return [];
    if (this.images.length > 0) {
      return this.images
    }

    let n: number = this.rand(1, 1)

    do {
     this.images.push(this.generateRandom())
    } while (--n > 0)

    return this.images
  }

  private generateRandom(): StaticImage {
    return this.getFactory().createStaticImage(
      './src/assets/map.jpg',
      new Vector(Math.trunc(this.rand(1, 1)), Math.trunc(1)),
      this.map.getWidth(),
      this.map.getHeight(),
    )
  }

  private rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }
}
