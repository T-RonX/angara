import type { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class RectangleRenderer implements TypeRendererInterface {
  private x: number = 50
  private y: number = 50

  private angle: number = 0
  private radius: number = 25
  private centerX: number = 500
  private centerY: number = 200

  public render(c: CanvasRenderingContext2D, rectangle: Rectangle, renderContext: RenderContext): void {
    const offsetX: number = renderContext.getViewport().getPosition().x
    const offsetY: number = renderContext.getViewport().getPosition().y

    c.fillStyle = rectangle.getColor()
    c.fillRect(
      rectangle.getTopLeft().x - offsetX,
      rectangle.getTopLeft().y - offsetY,
      rectangle.getWidth(),
      rectangle.getHeight(),
    )
  }
}