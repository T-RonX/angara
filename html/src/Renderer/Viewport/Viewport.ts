import { ViewportVector } from '@/Renderer/Viewport/ViewportVector'
import type { PositionableInterface } from '@/Renderer/Positioning/PositionableInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Viewport implements PositionableInterface {
  public position: ViewportVector

  constructor(
    private canvas: HTMLCanvasElement,
    position: ViewportVector|null = null,
  ) {
    this.position = position ?? new ViewportVector()
  }

  public getPosition(): ViewportVector {
    return this.position
  }

  public getBoundingBox(): BoundingBox {
    return new BoundingBox(
      new Vector(this.position.x, this.position.y),
      new Vector(this.position.x + this.canvas.width, this.position.y + this.canvas.height)
    )
  }
}
