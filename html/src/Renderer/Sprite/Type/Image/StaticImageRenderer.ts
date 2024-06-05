import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import type { Image as ImageSprite } from '@/Renderer/Sprite/Type/Image/Image'

export class StaticImageRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, image: ImageSprite, renderContext: RenderContext): void {

    const offsetX: number = renderContext.getViewport().getPosition().x
    const offsetY: number = renderContext.getViewport().getPosition().y

    // const img: HTMLImageElement = new Image()
    // img.src = 'test.jpeg'
    // img.onload = (e) => {
    //   c.drawImage(img, 1, 1,image.getWidth() - offsetX,image.getHeight() - offsetY);
    // }

    const i = new Image();
    i.src = image.src
    c.drawImage(i, image.getPosition().x - offsetX, image.getPosition().y - offsetY, image.getWidth(), image.getHeight())
  }
}