import type { Viewport } from '@/Renderer/Viewport/Viewport'
import type { CanvasRenderer } from '@/Renderer/CanvasRenderer'
import { MathX } from '@/Math/MathX'
import type { Camera } from '@/Game/Camera/Camera'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { CanvasMouseMoveInterface } from '@/Game/Input/CanvasMouseMoveInterface'
import type { SelectableInterface } from '@/Game/Input/SelectableInterface'

export class BlockMouseMove implements CanvasMouseMoveInterface {

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private renderer: CanvasRenderer,
    private camera: Camera,
  ) {
  }

  public onMouseMove(e: MouseEvent): void {
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
      if (this.isSelectable(sprite) && MathX.isPointInRectangle(x, y, sprites[i].getBoundingBox())) {
        this.canvas.style.cursor = 'pointer'

        return
      }
    }

    this.canvas.style.cursor = 'auto'
  }

  private isSelectable(sprite: SpriteInterface|SelectableInterface): sprite is SelectableInterface {
    return (sprite as SelectableInterface)?.isSelectable !== undefined
  }
}
