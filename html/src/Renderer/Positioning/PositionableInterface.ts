import type { BoundingBox } from '@/Renderer/Positioning/BoundingBox'

export interface PositionableInterface {
  getBoundingBox(): BoundingBox|null
}
