import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { RenderContext } from '@/Renderer/Context/RenderContext'

export interface AnimatorInterface {
  animate(sprite: SpriteInterface, renderContext: RenderContext): void
}
