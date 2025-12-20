import type { CanvasClickInterface } from '@/Game/Input/CanvasClickInterface'
import type { CanvasMouseDownInterface } from '@/Game/Input/CanvasMouseDownInterface'
import type { CanvasMouseUpInterface } from '@/Game/Input/CanvasMouseUpInterface'
import type { CanvasMouseMoveInterface } from '@/Game/Input/CanvasMouseMoveInterface'
import type { CanvasMouseOutInterface } from '@/Game/Input/CanvasMouseOutInterface'

export class Input {
  private canvas: HTMLCanvasElement | null = null

  private clickHandlers = new Map<CanvasClickInterface, EventListener>()
  private mouseDownHandlers = new Map<CanvasMouseDownInterface, EventListener>()
  private mouseUpHandlers = new Map<CanvasMouseUpInterface, EventListener>()
  private mouseMoveHandlers = new Map<CanvasMouseMoveInterface, EventListener>()
  private mouseOutHandlers = new Map<CanvasMouseOutInterface, EventListener>()

  constructor(
    private clickListeners: CanvasClickInterface[],
    private mouseDownListeners: CanvasMouseDownInterface[],
    private mouseUpListeners: CanvasMouseUpInterface[],
    private mouseMoveListeners: CanvasMouseMoveInterface[],
    private mouseOutListeners: CanvasMouseOutInterface[],
  ) {}

  public initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas

    this.clickListeners.forEach(c => {
      const handler = (e: Event) => c.onClick(e as MouseEvent)
      this.clickHandlers.set(c, handler)
      canvas.addEventListener('click', handler)
    })

    this.mouseDownListeners.forEach(c => {
      const handler = (e: Event) => c.onMouseDown(e as MouseEvent)
      this.mouseDownHandlers.set(c, handler)
      canvas.addEventListener('mousedown', handler)
    })

    this.mouseUpListeners.forEach(c => {
      const handler = (e: Event) => c.onMouseUp(e as MouseEvent)
      this.mouseUpHandlers.set(c, handler)
      canvas.addEventListener('mouseup', handler)
    })

    this.mouseMoveListeners.forEach(c => {
      const handler = (e: Event) => c.onMouseMove(e as MouseEvent)
      this.mouseMoveHandlers.set(c, handler)
      canvas.addEventListener('mousemove', handler)
    })

    this.mouseOutListeners.forEach(c => {
      const handler = (e: Event) => c.onMouseOut(e as MouseEvent)
      this.mouseOutHandlers.set(c, handler)
      canvas.addEventListener('mouseout', handler)
    })
  }

  public reset(): void {
    if (!this.canvas) return

    this.clickHandlers.forEach(handler =>
      this.canvas!.removeEventListener('click', handler)
    )
    this.mouseDownHandlers.forEach(handler =>
      this.canvas!.removeEventListener('mousedown', handler)
    )
    this.mouseUpHandlers.forEach(handler =>
      this.canvas!.removeEventListener('mouseup', handler)
    )
    this.mouseMoveHandlers.forEach(handler =>
      this.canvas!.removeEventListener('mousemove', handler)
    )
    this.mouseOutHandlers.forEach(handler =>
      this.canvas!.removeEventListener('mouseout', handler)
    )

    this.clickHandlers.clear()
    this.mouseDownHandlers.clear()
    this.mouseUpHandlers.clear()
    this.mouseMoveHandlers.clear()
    this.mouseOutHandlers.clear()

    this.canvas = null
  }
}
