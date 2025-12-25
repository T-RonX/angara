import type { Line } from '@/Renderer/Sprite/Type/Line/Line'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class LineRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, line: Line, renderContext: RenderContext): void {

    const offsetX: number = renderContext.getViewport().getPosition().x
    const offsetY: number = renderContext.getViewport().getPosition().y

    c.beginPath()
    c.moveTo(line.getFrom().x - offsetX, line.getFrom().y - offsetY)
    c.lineTo(line.getTo().x - offsetX, line.getTo().y - offsetY)
    c.lineWidth = line.getWidth()
    c.strokeStyle = line.getColor()
    c.stroke()
  }
}