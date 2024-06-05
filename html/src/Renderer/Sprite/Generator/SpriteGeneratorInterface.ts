import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { SpriteType } from '@/Renderer/Sprite/SpriteType'

export interface SpriteGeneratorInterface {
  getSprites(renderContext: RenderContext): SpriteInterface[]

  getSpriteType(): SpriteType
}
