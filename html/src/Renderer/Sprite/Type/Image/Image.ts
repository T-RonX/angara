import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Image extends AbstractSprite implements SpriteInterface {
  constructor(
    public src: string,
    private position: Vector,
    private width: number,
    private height: number,
  ) {
    super()
  }

  public getPosition(): Vector {
    return this.position
  }

  public getSrc(): string {
    return this.src
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }

  public getBoundingBox(): BoundingBox|null {
    const bottomRightX: number = this.position.x + this.width
    const bottomRightY: number = this.position.y + this.height

    const bottomRightCoord = new Vector(bottomRightX, bottomRightY)

    return new BoundingBox(this.position, bottomRightCoord)
  }
}
