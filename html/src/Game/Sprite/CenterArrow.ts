import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { AnimatorInterface } from '@/Renderer/Animation/AnimatorInterface'
import { Path } from '@/Renderer/Sprite/Type/Path/Path'
import { MathX } from '@/Math/MathX'
import type { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'

export class CenterArrow extends AbstractSpriteGenerator implements SpriteGeneratorInterface, AnimatorInterface {
  private angle: number = 0
  private angles: number[] = []
  private arrowDefaultRotationAngle: number = (Math.PI / 180) * 270

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    const mapCenterDot = this.createMapCenterDot(renderContext)
    const arrow: Path = this.createArrow()
    this.angles = this.getArrowAngles(arrow)

    return [arrow, mapCenterDot]
  }

  private createMapCenterDot(renderContext: RenderContext): Rectangle {
    return this.getFactory().createRectangle(
      new Vector(
        Math.trunc((renderContext.getInnerWidth() / 2) - 4),
        Math.trunc(renderContext.getInnerHeight() / 2) - 4,
      ),
      8, 8, 'yellow',
    )
  }

  private createArrow(): Path {
    return this.getFactory().createPath([
        new Vector(0, 0),
        new Vector(12, 50),
        new Vector(-12, 50),
        new Vector(0, 0),
      ],
      '#bd4131',
      '#c7958f',
      this,
    )
  }

  private getArrowAngles(arrow: Path): number[] {
    const angles: number[] = []
    const arrowCentered: Path = new Path(arrow.shift(arrow.getCentroid()), arrow.getFillColor(), arrow.getStrokeColor())
    const points: Vector[] = arrowCentered.getPoints()

    angles[0] = Math.atan2(points[0].y, points[0].x)
    angles[1] = Math.atan2(points[1].y, points[1].x)
    angles[2] = Math.atan2(points[2].y, points[2].x)
    angles[3] = Math.atan2(points[3].y, points[3].x)

    return angles
  }

  public animate(path: Path, renderContext: RenderContext): void {
    // Update the new angle
    this.angle = Math.atan2(renderContext.getViewport().getPosition().x, renderContext.getViewport().getPosition().y)

    // Get point relative to center
    const pathCentered: Path = new Path(path.shift(path.getCentroid()))
    let points: Vector[] = pathCentered.getPoints()

    // Viewport center
    const viewPortCenterX: number = renderContext.getCanvas().getBoundingClientRect().width / 2
    const viewportCenterY: number = renderContext.getCanvas().getBoundingClientRect().height / 2
    const viewportCenter: Vector = new Vector(viewPortCenterX, viewportCenterY)

    // Map center
    const mapCenter: Vector = new Vector(
      Math.trunc(renderContext.getInnerWidth() / 2),
      Math.trunc(renderContext.getInnerHeight() / 2),
    )

    // Only show arrow when center of map is not visible
    if (MathX.isPointInRectangle(mapCenter.x, mapCenter.y, renderContext.getViewport().getBoundingBox())) {
      path.setDoRender(false)
      return
    }
    else {
      path.setDoRender(true)
    }

    // Angle to map center
    const mapCoordInViewport = new Vector(
      Math.trunc(renderContext.getViewport().getPosition().x + viewPortCenterX),
      Math.trunc(renderContext.getViewport().getPosition().y + viewportCenterY),
    )
    const angleToMapCenter: number = this.getAngle(mapCenter, pathCentered.getCentroid().add(mapCoordInViewport)) + Math.PI

    // Get the new position
    const newPos: Vector = this.rotatePoint(
      viewportCenter,
      (renderContext.getCanvas().getBoundingClientRect().width / 2) - 50,
      (renderContext.getCanvas().getBoundingClientRect().height / 2) - 50,
      viewportCenter,
      angleToMapCenter,
    )

    // Rotate and align the arrow
    const baseAngle: number = this.getAngle(mapCenter, renderContext.getViewport().getPosition().add(newPos))

    points = [
      this.rotatePoint(pathCentered.getCentroid(), 0, 0, points[0], this.angles[0] + baseAngle + this.arrowDefaultRotationAngle),
      this.rotatePoint(pathCentered.getCentroid(), 0, 0, points[1], this.angles[1] + baseAngle + this.arrowDefaultRotationAngle),
      this.rotatePoint(pathCentered.getCentroid(), 0, 0, points[2], this.angles[2] + baseAngle + this.arrowDefaultRotationAngle),
      this.rotatePoint(pathCentered.getCentroid(), 0, 0, points[3], this.angles[3] + baseAngle + this.arrowDefaultRotationAngle),
    ]

    // Move to new position in viewport
    path.setPoints([
      points[0].add(newPos),
      points[1].add(newPos),
      points[2].add(newPos),
      points[3].add(newPos),
    ])
  }

  private rotatePoint(origin: Vector, offsetToOriginX: number, offsetToOriginY: number, point: Vector, angle: number): Vector {
    const distance: number = Math.sqrt(Math.pow(point.x - origin.x, 2) + Math.pow(point.y - origin.y, 2))
    const newX: number = origin.x + (distance + offsetToOriginX) * Math.cos(angle)
    const newY: number = origin.y + (distance + offsetToOriginY) * Math.sin(angle)

    return new Vector(newX, newY)
  }

  private getAngle(point1: Vector, point2: Vector): number {
    const deltaX: number = point2.x - point1.x
    const deltaY: number = point2.y - point1.y

    return Math.atan2(deltaY, deltaX)
  }
}