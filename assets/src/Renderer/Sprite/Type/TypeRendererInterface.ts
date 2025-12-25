import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { RenderContext } from '@/Renderer/Context/RenderContext'

export interface TypeRendererInterface {
  render(ctx: CanvasRenderingContext2D, sprite: SpriteInterface, renderContext: RenderContext): void
}
