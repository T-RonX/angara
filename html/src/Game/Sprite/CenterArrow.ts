import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { AnimatorInterface } from '@/Renderer/Animation/AnimatorInterface'
import { Path } from '@/Renderer/Sprite/Type/Path/Path'
import { MathX } from '@/Math/MathX'
import type { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import { AbstractAssetGenerator } from '@/Game/Assets/AbstractAssetGenerator'
import type { State } from '@/Game/State/State'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'

export class CenterArrow extends AbstractAssetGenerator implements SpriteGeneratorInterface, AnimatorInterface {
  private angles: number[] = []
  private arrowDefaultRotationAngle: number = (Math.PI / 180) * 270

  constructor(
    spriteType: SpriteType,
    private gameState: State
  ) {
    super(spriteType)
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    const arrow: Path = this.createArrow()
    this.angles = this.getArrowAngles(arrow)

    return [arrow]
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
      'center-arrow',
    )
  }

  private getArrowAngles(arrow: Path): number[] {
    const angles: number[] = []
    const arrowCentered: Path = new Path(arrow.shift(arrow.getCentroid()))
    const points: Vector[] = arrowCentered.getPoints()
    console.debug('added');

    angles[0] = Math.atan2(points[0].y, points[0].x)
    angles[1] = Math.atan2(points[1].y, points[1].x)
    angles[2] = Math.atan2(points[2].y, points[2].x)
    angles[3] = Math.atan2(points[3].y, points[3].x)

    return angles
  }

  public animate(path: Path, renderContext: RenderContext): void {
    console.debug('animate');

    // Get point relative to center
    const pathCentered: Path = new Path(path.shift(path.getCentroid()))
    const points: Vector[] = pathCentered.getPoints()

    // Viewport center
    const viewPortCenterX: number = renderContext.getCanvas().getBoundingClientRect().width / 2
    const viewportCenterY: number = renderContext.getCanvas().getBoundingClientRect().height / 2
    const viewportCenter: Vector = new Vector(viewPortCenterX, viewportCenterY)

    // Focus center
    const focusPoint: Vector|undefined = this.gameState.hasSelectedAsset() ? this.gameState.getSelectedAsset().getBoundingBox()?.getCenter() : undefined
    console.debug(focusPoint);
    if (focusPoint === undefined) {
      path.setDoRender(false)
      return
    }

    // Only show arrow when center of map is not visible
    if (MathX.isPointInRectangle(focusPoint.x, focusPoint.y, renderContext.getViewport().getBoundingBox())) {
      path.setDoRender(false)
      return
    } else {
      path.setDoRender(true)
    }

    // Angle to map center
    const mapCoordInViewport = new Vector(
      Math.trunc(renderContext.getViewport().getPosition().x + viewPortCenterX),
      Math.trunc(renderContext.getViewport().getPosition().y + viewportCenterY),
    )
    const angleToMapCenter: number = this.getAngle(focusPoint, pathCentered.getCentroid().add(mapCoordInViewport)) + Math.PI

    // Get the new position
    const newPos: Vector = this.rotatePoint(
      viewportCenter,
      (renderContext.getCanvas().getBoundingClientRect().width / 2) - 50,
      (renderContext.getCanvas().getBoundingClientRect().height / 2) - 50,
      viewportCenter,
      angleToMapCenter,
    )

    // Rotate and align the arrow
    const baseAngle: number = this.getAngle(focusPoint, renderContext.getViewport().getPosition().add(newPos))

    // Update the path points with rotation to center and position in viewport
    for (const [i, point] of points.entries()) {
      path.setPoint(i,
        this.rotatePoint(
          pathCentered.getCentroid(),
          0,
          0,
          point,
          this.angles[i] + baseAngle + this.arrowDefaultRotationAngle
        ).add(newPos)
      )
    }
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