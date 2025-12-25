import { Vector } from '@/Renderer/Positioning/Vector'

export class ViewportVector extends Vector {
  constructor(
    x: number = 0,
    y: number = 0,
    public z: number = 0
  ) {
    super(x, y)
  }
}
