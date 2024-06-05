import { Vector } from '@/Renderer/Positioning/Vector'
import { Rectangle } from '@/Shapes/Rectangle'

export class BoundingBox extends Rectangle {
  constructor(
    topLeft: Vector,
    lowerRight: Vector,
  ) {
    super(topLeft.x, topLeft.y, lowerRight.x, lowerRight.y)
  }
}
