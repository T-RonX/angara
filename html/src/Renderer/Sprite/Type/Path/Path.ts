import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Path extends AbstractSprite implements SpriteInterface {
  constructor(
    private color: string,
    private points: Vector[],
  ) {
    super()
  }

  public getPoints(): Vector[] {
    return this.points
  }

  public setPoints(points: Vector[]): void {
    this.points = points
  }

  public getColor(): string {
    return this.color
  }

  public shift(vector: Vector): Vector[] {
    const newPoints: Vector[] = []

    for (const point of this.points) {
      newPoints.push(point.sub(vector))
    }

    return newPoints
  }

  public getCentroid(): Vector {
    // Initialize sums for x and y coordinates
    let sumX = 0
    let sumY = 0

    // Iterate through points and sum their coordinates
    for (const point of this.points) {
      sumX += point.x
      sumY += point.y
    }

    // Calculate the average (centroid) for x and y
    const centerX = sumX / this.points.length
    const centerY = sumY / this.points.length

    // Return the centroid coordinates as an array
    return new Vector(centerX, centerY)
  }

  public getBoundingBox(): BoundingBox|null {
    return null
    let maxX: number = 0
    let maxY: number = 0
    let minX: number = Number.MAX_VALUE
    let minY: number = Number.MAX_VALUE

    for (const point of this.points) {
      if (point.x < minX) {
        minX = point.x
      }

      if (point.x > maxX) {
        maxX = point.x
      }

      if (point.y < minY) {
        minY = point.y
      }

      if (point.y > maxY) {
        maxY = point.y
      }
    }

    const topLeftCoord: Vector = new Vector(maxX, minY)
    const bottomRightCoord: Vector = new Vector(maxX, maxY)
    return new BoundingBox(topLeftCoord, bottomRightCoord)
  }
}
