import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Text extends AbstractSprite implements SpriteInterface {
  constructor(
    public text: string,
    public position: Vector,
    private font: string,
    private color: string,
  ) {
    super()
  }

  public getText(): string {
    return this.text
  }

  public getPosition(): Vector {
    return this.position
  }

  public getFont(): string {
    return this.font
  }

  public getColor(): string {
    return this.color
  }

  public getBoundingBox(): BoundingBox|null {
    return null
  }
}
