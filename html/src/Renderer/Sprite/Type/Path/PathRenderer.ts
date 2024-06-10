import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import { Path } from '@/Renderer/Sprite/Type/Path/Path'
import { Vector } from '@/Renderer/Positioning/Vector'
import { MathX } from '@/Math/MathX'

export class PathRenderer implements TypeRendererInterface {
  private angle: number = 0

  public render(c: CanvasRenderingContext2D, path: Path, renderContext: RenderContext): void {
    // Update the new angle
    this.angle = Math.atan2(renderContext.getViewport().getPosition().x, renderContext.getViewport().getPosition().y)

    // Get point relative to center
    path = new Path(path.getColor(), path.shift(path.getCentroid()))
    let points = path.getPoints()

    // Viewport center
    const viewPortCenterX: number = renderContext.getCanvas().getBoundingClientRect().width / 2
    const viewportCenterY: number = renderContext.getCanvas().getBoundingClientRect().height / 2
    const viewportCenter: Vector = new Vector(viewPortCenterX, viewportCenterY)

    // Map center
    const mapCenter = new Vector(
      Math.trunc(renderContext.getInnerWidth() / 2),
      Math.trunc(renderContext.getInnerHeight() / 2),
    )

    // Only show arrow when center of map is not visible
    if (MathX.isPointInRectangle(mapCenter.x, mapCenter.y, renderContext.getViewport().getBoundingBox())) {
      return;
    }

    // Angle to map center
    const mapCoordInViewport = new Vector(
      Math.trunc(renderContext.getViewport().getPosition().x + viewPortCenterX),
      Math.trunc(renderContext.getViewport().getPosition().y + viewportCenterY),
    )
    const angleToMapCenter = this.getAngleInRadians(mapCenter, path.getCentroid().add(mapCoordInViewport)) + Math.PI

    // Angle of path points
    const angles = [
      Math.atan2(points[0].y, points[0].x),
      Math.atan2(points[1].y, points[1].x),
      Math.atan2(points[2].y, points[2].x),
      Math.atan2(points[3].y, points[3].x),
    ]

    // Get the new position
    const newPos = this.rotatePoint(
      viewportCenter,
      (c.canvas.getBoundingClientRect().width / 2) - 50,
      (c.canvas.getBoundingClientRect().height / 2) - 50,
      viewportCenter,
      angleToMapCenter
    )

    // Rotate and align the arrow
    const rotateAlign: number = (Math.PI / 180) * 90
    const baseAngle: number = this.getAngleInRadians(mapCenter, renderContext.getViewport().getPosition().add(newPos)) + Math.PI

    points = [
      this.rotatePoint(path.getCentroid(), 0, 0, points[0], angles[0] + baseAngle + rotateAlign),
      this.rotatePoint(path.getCentroid(), 0, 0, points[1], angles[1] + baseAngle + rotateAlign),
      this.rotatePoint(path.getCentroid(), 0, 0, points[2], angles[2] + baseAngle + rotateAlign),
      this.rotatePoint(path.getCentroid(), 0, 0, points[3], angles[3] + baseAngle + rotateAlign),
    ]

    // Move to new position in viewport
    points = [
      points[0].add(newPos),
      points[1].add(newPos),
      points[2].add(newPos),
      points[3].add(newPos),
    ]

    // Fill shape
    c.beginPath()
    c.fillStyle = path.getColor()
    for (const [i, point] of points.entries()) {
      if (i === 0) {
        c.moveTo(point.x, point.y)
      } else {
        c.lineTo(point.x, point.y)
      }
    }
    c.fill()

    // Draw edges
    c.beginPath()
    c.strokeStyle = '#c7958f'
    c.lineWidth = 1
    for (const [i, point] of points.entries()) {
      if (i === 0) {
        c.moveTo(point.x, point.y)
      } else {
        c.lineTo(point.x, point.y)
      }
    }
    c.stroke()
  }

  private rotatePoint(origin: Vector, offsetToOriginX: number, offsetToOriginY: number, point: Vector, angle: number): Vector {
    // Calculate distance from origin
    const distance = Math.sqrt(Math.pow(point.x - origin.x, 2) + Math.pow(point.y - origin.y, 2))

    // Calculate new coordinates using sine and cosine
    const newX = origin.x + (distance + offsetToOriginX) * Math.cos(angle)
    const newY = origin.y + (distance + offsetToOriginY) * Math.sin(angle)

    return new Vector(newX, newY)
  }

  private getAngleInRadians(point1: Vector, point2: Vector): number {
    // Calculate the change in x and y coordinates
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;

    // Use Math.atan2 for accurate angle calculation
    return Math.atan2(deltaY, deltaX);
  }
}
