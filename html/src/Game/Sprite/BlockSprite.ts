import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'

export class BlockSprite extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  private x: number = 50
  private y: number = 50

  private angle: number = 0
  private radius: number = 25
  private centerX: number = 500
  private centerY: number = 200

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    const centerX: number = this.centerX
    const centerY: number = this.centerY

    this.x = centerX + (this.radius * Math.cos(this.angle))
    this.y = centerY + (this.radius * Math.sin(this.angle))

    this.angle += 0.01

    if (this.angle >= Math.PI * 2) {
      this.angle = 0
    }

    return [
      this.getFactory().createRectangle(
      new Vector(this.x, this.y),
      100,
      50,
      '#ad3'
    )
    ]
  }
}