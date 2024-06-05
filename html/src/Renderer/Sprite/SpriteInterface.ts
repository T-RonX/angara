import type { PositionableInterface } from '@/Renderer/Positioning/PositionableInterface'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export interface SpriteInterface extends PositionableInterface {
  getTypeRenderer(): TypeRendererInterface

  getId(): number
}
