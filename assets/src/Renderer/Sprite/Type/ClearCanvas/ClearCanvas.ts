import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class ClearCanvas extends AbstractSprite implements SpriteInterface {
  constructor(
    private x: number,
    private y: number,
    private width: number,
    private height: number,
  ) {
    super()
  }

  public getX(): number {
    return this.x
  }

  public getY(): number {
    return this.y
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }

  public getBoundingBox(): BoundingBox|null {
    return null
    const topLeftCoord = new Vector(0, 0)
    // const bottomRightCoord = new Coordinate(this.x + this.width, this.y + this.height)
    const bottomRightCoord = new Vector(0, 0)

    return new BoundingBox(topLeftCoord, topLeftCoord)
  }
}
