import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import { Path } from '@/Renderer/Sprite/Type/Path/Path'

export class PathRenderer implements TypeRendererInterface {

  public render(c: CanvasRenderingContext2D, path: Path, renderContext: RenderContext): void {
    // Fill shape
    const fillColor: string|null = path.getFillColor()
    if (fillColor !== null) {
      c.beginPath()
      c.fillStyle = fillColor
      for (const [i, point] of path.getPoints().entries()) {
        if (i === 0) {
          c.moveTo(point.x, point.y)
        } else {
          c.lineTo(point.x, point.y)
        }
      }
      c.fill()
    }

    // Draw edges
    const strokeColor: string|null = path.getStrokeColor()
    if (strokeColor !== null) {
      c.beginPath()
      c.strokeStyle = strokeColor
      c.lineWidth = 1
      for (const [i, point] of path.getPoints().entries()) {
        if (i === 0) {
          c.moveTo(point.x, point.y)
        } else {
          c.lineTo(point.x, point.y)
        }
      }
      c.stroke()
    }
  }
}
