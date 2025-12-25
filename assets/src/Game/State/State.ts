import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { AssetStore } from '@/Game/Assets/AssetStore'

export class State {
  private selectedAssetId: number|undefined = undefined

  constructor(private assetStore: AssetStore<any>) {
  }

  public setSelectedAsset(asset: SpriteInterface|null): void {
    this.selectedAssetId = asset?.getId()
  }

  public isSelectedAssetId(id: number): boolean {
    return this.selectedAssetId !== undefined && id === this.selectedAssetId
  }

  public hasSelectedAsset(): boolean {
    return this.selectedAssetId !== undefined
  }

  public getSelectedAsset(): SpriteInterface {
    if (this.selectedAssetId === undefined) {
      throw new Error('No selected asset')
    }

    return this.assetStore.get(this.selectedAssetId)
  }
}
