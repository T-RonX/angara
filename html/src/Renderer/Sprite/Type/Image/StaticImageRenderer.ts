import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import type { StaticImage as ImageSprite } from '@/Renderer/Sprite/Type/Image/StaticImage'

export class StaticImageRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, image: ImageSprite, renderContext: RenderContext): void {
    if (!image.isImageLoaded()) {
      // Optionally render a placeholder or skip rendering
      return
    }

    const bitmap = image.getBitmap()
    if (bitmap) {
      c.drawImage(
        bitmap,
        image.getPosition().x - renderContext.getViewport().getPosition().x,
        image.getPosition().y - renderContext.getViewport().getPosition().y,
        image.getWidth(),
        image.getHeight(),
      )
    }
  }
}