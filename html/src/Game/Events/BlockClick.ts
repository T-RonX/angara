import type { Viewport } from '@/Renderer/Viewport/Viewport'
import type { CanvasRenderer } from '@/Renderer/CanvasRenderer'
import { MathX } from '@/Math/MathX'
import { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import type { CanvasMouseUpInterface } from '@/Game/Input/CanvasMouseUpInterface'
import type { Camera } from '@/Game/Camera/Camera'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'

export class BlockClick implements CanvasMouseUpInterface {
  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private renderer: CanvasRenderer,
    private camera: Camera,
  ) {
  }

  public onMouseUp(e: MouseEvent): void {
    if (this.camera.getIsPanning()) {
      return
    }

    const rect: DOMRect = this.canvas.getBoundingClientRect()
    const x: number = Math.round(e.clientX - rect.left + this.viewport.getPosition().x)
    const y: number = Math.round(e.clientY - rect.top + this.viewport.getPosition().y)

    const sprites: SpriteInterface[] = this.renderer.getActiveSprites()
    const spriteLength: number = this.renderer.getActiveSprites().length

    for (let i: number = 0; i < spriteLength; ++i) {
      const sprite: SpriteInterface = sprites[i]
      if (sprite instanceof Rectangle && MathX.isPointInRectangle(x, y, sprites[i].getBoundingBox())) {
          sprite.toggleColor('crimson')
        break
      }
    }
  }
}
