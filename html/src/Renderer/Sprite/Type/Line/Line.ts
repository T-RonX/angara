import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Line extends AbstractSprite implements SpriteInterface {
  constructor(
    public from: Vector,
    private to: Vector,
    private width: number,
    private color: string,
  ) {
    super()
  }

  public getFrom(): Vector {
    return this.from
  }

  public getTo(): Vector {
    return this.to
  }

  public getWidth(): number {
    return this.width
  }

  public getColor(): string {
    return this.color
  }

  public getBoundingBox(): BoundingBox|null {
    let topLeftX: number = Math.min(this.from.x, this.to.x)
    let topLeftY: number = Math.min(this.from.y, this.to.y)

    let bottomRightX: number = Math.max(this.from.x, this.to.x)
    let bottomRightY: number = Math.max(this.from.y, this.to.y)

    topLeftX -= Math.floor(this.width / 2)
    topLeftY -= Math.floor(this.width / 2)

    bottomRightX += Math.ceil(this.width / 2)
    bottomRightY += Math.ceil(this.width / 2)

    const topLeftCoord = new Vector(topLeftX, topLeftY)
    const bottomRightCoord = new Vector(bottomRightX, bottomRightY)

    return new BoundingBox(topLeftCoord, bottomRightCoord)
  }
}
