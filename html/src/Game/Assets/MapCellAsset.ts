import { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import type { SelectableInterface } from '@/Game/Input/SelectableInterface'

export class MapBlockAsset extends Rectangle implements SelectableInterface{
  public isSelectable(): boolean {
    return true
  }
}