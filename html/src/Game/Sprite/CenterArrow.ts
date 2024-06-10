import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'

export class CenterArrow extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  private x: number = 50
  private y: number = 50

  private angle: number = 0
  private radius: number = 25
  private centerX: number = 500
  private centerY: number = 200

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    const centerX: number = renderContext.getCanvas().getBoundingClientRect().width / 2
    const centerY: number = renderContext.getCanvas().getBoundingClientRect().height / 2

    this.angle += 0.01

    if (this.angle >= Math.PI * 2) {
      this.angle = 0
    }

    const width = 12
    const height = 50

    return [
      this.getFactory().createPath(
        '#bd4131',
        [
          new Vector(0, 0),
          new Vector(width, height),
          new Vector(-width, height),
          new Vector(0, 0),
        ]),
      this.getFactory().createRectangle(
        new Vector(
          Math.trunc((renderContext.getInnerWidth() / 2) - 4),
          Math.trunc(renderContext.getInnerHeight() / 2) - 4
        ),
        8, 8, 'yellow',
      )
    ]
  }
}