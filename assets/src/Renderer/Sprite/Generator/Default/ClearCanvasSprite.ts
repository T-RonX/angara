import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'

export class ClearCanvasSprite extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    return [this.getFactory().createClearCanvas(
      0,
      0,
      renderContext.getCanvas().width,
      renderContext.getCanvas().height,
    )]
  }
}
