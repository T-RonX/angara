import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Rectangle extends AbstractSprite implements SpriteInterface {
  constructor(
    public topLeft: Vector,
    private width: number,
    private height: number,
    private color: string,
  ) {
    super()
  }

  public getTopLeft(): Vector {
    return this.topLeft
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }

  public getColor(): string {
    return this.color
  }

  private oldColor: string = ''

  public setColor(color: string): void {
    this.color = color
  }

  public toggleColor(color: string): void {
    if (this.oldColor === '') {
      this.oldColor = this.color
      this.color = color
    } else {
      this.oldColor = ''
      this.color = this.oldColor
    }
  }

  public getBoundingBox(): BoundingBox|null {
    const bottomRightCoord: Vector = new Vector(this.topLeft.x + this.width, this.topLeft.y + this.height)

    return new BoundingBox(this.topLeft, bottomRightCoord)
  }
}
