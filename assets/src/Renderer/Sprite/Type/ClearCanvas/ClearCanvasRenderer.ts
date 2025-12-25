import type { ClearCanvas } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvas'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class ClearCanvasRenderer implements TypeRendererInterface {
  public render(c: CanvasRenderingContext2D, clearCanvas: ClearCanvas, renderContext: RenderContext): void {
    c.clearRect(
      clearCanvas.getX(),
      clearCanvas.getY(),
      clearCanvas.getWidth(),
      clearCanvas.getHeight(),
    )
  }
}