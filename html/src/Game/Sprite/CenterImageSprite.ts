import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import { Map } from '@/Game/Map/Map'
import type { Image } from '@/Renderer/Sprite/Type/Image/Image'

export class CenterImageSprite extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  private images: Image[] = []

  constructor(spriteType: SpriteType, private map: Map) {
    super(spriteType)
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    if (this.images.length > 0) {
      return this.images
    }
    const width = 1500
    const height = 1500

    let n = this.rand(1, 1)

    do {
     this.images.push(this.generateRandom())
    } while (--n > 0)

    return this.images
  }

  private generateRandom(): Image {
    return this.getFactory().createStaticImage(
      './src/assets/l3r9nszl9pj71.jpg',
      new Vector(Math.trunc(this.rand(1, 1)), Math.trunc(1)),
      this.rand(this.map.getWidth(), this.map.getHeight()),
      this.rand(this.map.getWidth(), this.map.getHeight()),
    )
  }

  private rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

}