import type { CanvasMouseMoveInterface } from '@/Game/Input/CanvasMouseMoveInterface'
import type { CanvasMouseUpInterface } from '@/Game/Input/CanvasMouseUpInterface'
import type { CanvasMouseDownInterface } from '@/Game/Input/CanvasMouseDownInterface'
import type { CanvasMouseOutInterface } from '@/Game/Input/CanvasMouseOutInterface'
import type { Camera } from '@/Game/Camera/Camera'

export class CameraMouseEvents implements CanvasMouseDownInterface, CanvasMouseMoveInterface, CanvasMouseUpInterface, CanvasMouseOutInterface {
  private isMouseDown: boolean = false
  private camera: Camera

  constructor(camera: Camera) {
    this.camera = camera
  }

  public onMouseDown(e: MouseEvent): void {
    if (e.button == 0) {
      this.isMouseDown = true
    }
  }

  public onMouseMove(e: MouseEvent): void {
    if (this.camera.getIsPanning()) {
      this.camera.panViewport(e)
    } else if (this.isMouseDown) {
      this.camera.enablePanningWhenDeadzoneThresholdIsReached(e)
    } else if (!this.camera.getIsInertiaPanning()) {
      this.camera.initiateInertiaPanningWhenRequired()
    }
  }

  public onMouseUp(e: MouseEvent): void {
    if (e.button == 0) {
      if (this.camera.getIsPanning()) {
        this.camera.setInertiaPanningParameters()
      }

      this.isMouseDown = false
      this.camera.stopPhysicalPanning()
    }
  }

  public onMouseOut(e: MouseEvent): void {
    if (e.button == 0) {
      this.isMouseDown = false
      this.camera.stopPhysicalPanning()
    }
  }
}
