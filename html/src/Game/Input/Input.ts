import type { CanvasClickInterface } from '@/Game/Input/CanvasClickInterface'
import type { CanvasMouseDownInterface } from '@/Game/Input/CanvasMouseDownInterface'
import type { CanvasMouseUpInterface } from '@/Game/Input/CanvasMouseUpInterface'
import type { CanvasMouseMoveInterface } from '@/Game/Input/CanvasMouseMoveInterface'
import type { CanvasMouseOutInterface } from '@/Game/Input/CanvasMouseOutInterface'

export class Input {
  constructor(
    private clickListeners: CanvasClickInterface[],
    private mouseDownListeners: CanvasMouseDownInterface[],
    private mouseUpListeners: CanvasMouseUpInterface[],
    private mouseMoveListeners: CanvasMouseMoveInterface[],
    private mouseOutListeners: CanvasMouseOutInterface[],
  ) {
  }

  public initialize(canvas: HTMLCanvasElement) {
    this.clickListeners.forEach((c: CanvasClickInterface) => canvas.addEventListener('click', (e) => c.onClick(e)))
    this.mouseDownListeners.forEach((c: CanvasMouseDownInterface) => canvas.addEventListener('mousedown', (e) => c.onMouseDown(e)))
    this.mouseUpListeners.forEach((c: CanvasMouseUpInterface) => canvas.addEventListener('mouseup', (e) => c.onMouseUp(e)))
    this.mouseMoveListeners.forEach((c: CanvasMouseMoveInterface) => canvas.addEventListener('mousemove', (e) => c.onMouseMove(e)))
    this.mouseOutListeners.forEach((c: CanvasMouseOutInterface) => canvas.addEventListener('mouseout', (e) => c.onMouseOut(e)))
  }
}
