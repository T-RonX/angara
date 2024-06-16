import type { Viewport } from '@/Renderer/Viewport/Viewport'
import type { CanvasRenderer } from '@/Renderer/CanvasRenderer'
import { MathX } from '@/Math/MathX'
import type { CanvasMouseUpInterface } from '@/Game/Input/CanvasMouseUpInterface'
import type { Camera } from '@/Game/Camera/Camera'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { State } from '@/Game/State/State'
import { MapBlockAsset } from '@/Game/Assets/MapBlockAsset'

export class BlockClick implements CanvasMouseUpInterface {
  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private renderer: CanvasRenderer,
    private camera: Camera,
    private gameState: State,
  ) {
  }

  public onMouseUp(e: MouseEvent): void {
    if (this.camera.getIsPanning() || e.button !== 0) {
      return
    }

    const rect: DOMRect = this.canvas.getBoundingClientRect()
    const x: number = Math.round(e.clientX - rect.left + this.viewport.getPosition().x)
    const y: number = Math.round(e.clientY - rect.top + this.viewport.getPosition().y)

    const sprites: SpriteInterface[] = this.renderer.getActiveSprites()
    const spriteLength: number = this.renderer.getActiveSprites().length

    for (let i: number = 0; i < spriteLength; ++i) {
      const sprite: SpriteInterface = sprites[i]
      if (sprite instanceof MapBlockAsset && MathX.isPointInRectangle(x, y, sprites[i].getBoundingBox())) {
        if (this.gameState.isSelectedAssetId(sprite.getId())) {
          (this.gameState.getSelectedAsset() as MapBlockAsset).toggleColor()
          this.gameState.setSelectedAsset(null)
          return
        }

        if (this.gameState.hasSelectedAsset()) {
          (this.gameState.getSelectedAsset() as MapBlockAsset).toggleColor()
        }

        sprite.toggleColor('crimson')
        this.gameState.setSelectedAsset(sprite)
        break
      }
    }
  }
}
