import type { Text } from '@/Renderer/Sprite/Type/Text/Text'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class StaticTextRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, text: Text, renderContext: RenderContext): void {
    const offsetX: number = renderContext.getViewport().getPosition().x
    const offsetY: number = renderContext.getViewport().getPosition().y

    c.font = text.getFont()
    c.fillStyle = text.getColor()
    c.fillText(text.getText(), text.position.x - offsetX, text.position.y - offsetY)
  }
}