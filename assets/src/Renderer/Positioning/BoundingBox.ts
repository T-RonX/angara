import { Vector } from '@/Renderer/Positioning/Vector'
import { Rectangle } from '@/Shapes/Rectangle'

export class BoundingBox extends Rectangle {
  constructor(
    topLeft: Vector,
    lowerRight: Vector,
  ) {
    super(topLeft.x, topLeft.y, lowerRight.x, lowerRight.y)
  }

  public getCenter(): Vector {
    return new Vector(
      this.topLeftX + Math.trunc((this.lowerRightX - this.topLeftX) / 2),
      this.topLeftY + Math.trunc((this.lowerRightY - this.topLeftY) / 2),
    )
  }
}
