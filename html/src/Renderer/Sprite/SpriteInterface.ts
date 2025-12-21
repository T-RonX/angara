import type { PositionableInterface } from '@/Renderer/Positioning/PositionableInterface'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import type { AnimatorInterface } from '@/Renderer/Animation/AnimatorInterface'

export interface SpriteInterface extends PositionableInterface {
  getTypeRenderer(): TypeRendererInterface

  getId(): number

  hasAnimator(): boolean

  getAnimator(): AnimatorInterface

  getDoRender(): boolean

  isVisible(): boolean
}
