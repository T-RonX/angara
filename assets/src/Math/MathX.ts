import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import type { Rectangle } from '@/Shapes/Rectangle'

export class MathX {
  public static clamp(value: number, min: number, max: number): number {
    return value < min ? min : (value > max ? max : value)
  }

  public static range(start: number, end: number, step = 1): number[] {
    const range: number[] = []

    for (let i: number = start; i <= end; i += step) {
      range.push(i)
    }

    return range
  }

  public static doesRectangleOverlap(objectBox: BoundingBox|null, viewportBox: BoundingBox|null): boolean {
    if (objectBox === null || viewportBox === null) {
      return true
    }

    if (objectBox.topLeftX < viewportBox.lowerRightX && objectBox.lowerRightX > viewportBox.topLeftX) {
      // There is horizontal overlap

      // Check for vertical overlap
      if (objectBox.topLeftY < viewportBox.lowerRightY && objectBox.lowerRightY > viewportBox.topLeftY) {
        // There is both horizontal and vertical overlap, return true
        return true
      }
    }

    // No overlap detected, return false
    return false
  }

  public static isPointInRectangle(x: number, y: number, rect: Rectangle|null): boolean {
    return rect !== null && (rect.topLeftX <= x && x <= rect.lowerRightX) && (rect.topLeftY <= y && y <= rect.lowerRightY);
  }
}
