import type { Line } from '@/Renderer/Sprite/Type/Line/Line'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class PathRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, line: Line, renderContext: RenderContext): void {

    const offsetX: number = renderContext.getViewport().getPosition().x
    const offsetY: number = renderContext.getViewport().getPosition().y

    c.beginPath()
    c.moveTo(25, 25)
    c.lineTo(105, 25)
    c.lineTo(25, 105)
    c.fill()
  }
}