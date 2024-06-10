import { MathX } from '@/Math/MathX'
import { RenderContext } from '@/Renderer/Context/RenderContext'
import { Map } from '@/Game/Map/Map'
import { ViewportVector } from '@/Renderer/Viewport/ViewportVector'

export class Camera {

  /**
   * When holding down the mouse button, allow this many
   * pixes to be moved before start panning the viewport.
   */
  private DRAG_THRESHOLD: number = 5

  /**
   * Distance in pixels to allow the viewport to surpass the map boundaries for clarity.
   */
  private MAX_CAMERA_OVERFLOW: number = 100

  /**
   * Time in milliseconds after dragging and releasing the mouse button
   * before inertia panning is initiated. This way we allow dragging without
   * engaging the inertia panning all the time. It makes you 'throw' the map more.
   */
  private MIN_INERTIA_PANNING_START_IDLE_TIMEOUT: number = 10

  /**
   * The amount of mouse move ticks to log used for determining the direction of the inertia panning
   */
  private MOUSE_MOVE_DELTA_LOG_COUNT_60HZ: number = 3
  /**
   * Modifies the time it takes for the inertia drag to complete
   * Lower slightly for slower decay.
   */
  private PANNING_INERTIA_DECAY_MODIFIER_60HZ: number = .085

  private panningThreshold: [x: number, y: number] = [this.DRAG_THRESHOLD, this.DRAG_THRESHOLD]
  private latestPanningDeltas: [number, number][] = []
  private isInertiaPanning: boolean = false
  private lastMoveTime: number = 0
  private panningDirection: number = 0
  private panningVelocity: number = 0
  private isPanning: boolean = false
  private refreshRate: number = 60

  constructor(
    private rendererContext: RenderContext,
    private map: Map,
  ) {
  }

  public setPosition(x: number, y: number): void {
    this.rendererContext.getViewport().getPosition().x = x
    this.rendererContext.getViewport().getPosition().y = y
  }

  /**
   * Pan the actual viewport according to the physical movement of the pointer
   */
  public panViewport(e: MouseEvent): void {
    const coord: ViewportVector = this.rendererContext.getViewport().getPosition()

    // Get the new viewport position coordinates based on the current movement delta, limited to the map borders
    const newX: number = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(coord.x - e.movementX, -this.MAX_CAMERA_OVERFLOW, this.map.getWidth() - this.rendererContext.getCanvas().width + this.MAX_CAMERA_OVERFLOW))
    const newY: number = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(coord.y - e.movementY, -this.MAX_CAMERA_OVERFLOW, this.map.getHeight() - this.rendererContext.getCanvas().height + this.MAX_CAMERA_OVERFLOW))

    coord.x = newX
    coord.y = newY

    this.monitorMouseMoveDeltaForInertiaPan(e)
  }

  /**
   * Calculates the panning momentum (speed and direction) and
   * sets it to the viewport
   */
  public setInertiaPanningParameters(): void {
    const isInertiaIdleTimeoutReached: boolean = performance.now() - this.lastMoveTime < this.MIN_INERTIA_PANNING_START_IDLE_TIMEOUT

    if (isInertiaIdleTimeoutReached) {
      let xSum: number = 0
      let ySum: number = 0

      for (const [x, y] of this.latestPanningDeltas) {
        xSum += x
        ySum += y
      }

      const xAvg: number = xSum / this.latestPanningDeltas.length
      const yAvg: number = ySum / this.latestPanningDeltas.length

      const angleRad = Math.atan2(-yAvg, xAvg)
      const velocity = Math.abs(xAvg) + Math.abs(yAvg)

      this.panningDirection = angleRad
      this.panningVelocity = velocity
    }
  }

  /**
   * Log the latest pointer move deltas. Used for calculating the speed and angle of inertia panning.
   */
  public monitorMouseMoveDeltaForInertiaPan(e: MouseEvent): void {
    this.latestPanningDeltas.push([e.movementX, e.movementY])
    this.lastMoveTime = performance.now()

    // Only log the last 10 delta increments
    if (this.latestPanningDeltas.length > this.getMouseMoveDeltaLogCount()) {
      this.latestPanningDeltas.shift()
    }
  }

  /**
   * When holding the drag button down and the minimum movement delta is reached, enable viewport panning.
   */
  public enablePanningWhenDeadzoneThresholdIsReached(e: MouseEvent): void {
    this.panningThreshold[0] -= Math.abs(e.movementX)
    this.panningThreshold[1] -= Math.abs(e.movementY)

    const isDeadzoneThresholdIsReached: boolean = this.panningThreshold[0] <= 0 || this.panningThreshold[1] <= 0

    if (isDeadzoneThresholdIsReached) {
      this.isPanning = true
    }
  }

  public initiateInertiaPanningWhenRequired(): void {
    const requireInertiaPanning: boolean = this.panningVelocity > 0

    if (requireInertiaPanning) {
      this.isInertiaPanning = true
      this.doInertiaPanning()
    }
  }

  private doInertiaPanning = (): void => {
    const deltaX: number = this.panningVelocity * Math.cos(this.panningDirection)
    const deltaY: number = this.panningVelocity * Math.sin(this.panningDirection)

    const newX = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(this.rendererContext.getViewport().getPosition().x - deltaX, -this.MAX_CAMERA_OVERFLOW, this.map.getWidth() - this.rendererContext.getCanvas().width + this.MAX_CAMERA_OVERFLOW))
    const newY = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(this.rendererContext.getViewport().getPosition().y + deltaY, -this.MAX_CAMERA_OVERFLOW, this.map.getHeight() - this.rendererContext.getCanvas().height + this.MAX_CAMERA_OVERFLOW))

    this.rendererContext.getViewport().getPosition().x = newX
    this.rendererContext.getViewport().getPosition().y = newY

    const speedModifier: number = (this.getPanningInertiaDecayModifier() * this.panningVelocity) * 2

    this.panningVelocity = this.panningVelocity - speedModifier

    if (this.panningVelocity < 0){
      this.isInertiaPanning = false

      return
    }
    else {
      window.requestAnimationFrame(this.doInertiaPanning)
    }
  }

  /**
   * Sets the panning deadzone to its default value, allowing pointer deadzone move again.
   */
  public resetPanningDeadzoneThreshold(): void {
    this.panningThreshold[0] = this.DRAG_THRESHOLD
    this.panningThreshold[1] = this.DRAG_THRESHOLD
  }

  public stopPhysicalPanning(): void {
    this.isPanning = false

    this.resetPanningDeadzoneThreshold()
  }

  public getIsInertiaPanning(): boolean {
    return this.isInertiaPanning
  }

  public getIsPanning(): boolean {
    return this.isPanning
  }

  public setRefreshRate(refreshRate: number): void {
    this.refreshRate = refreshRate
  }

  public getMouseMoveDeltaLogCount(): number {
    return Math.trunc(this.MOUSE_MOVE_DELTA_LOG_COUNT_60HZ * (this.refreshRate / 60))
  }

  public getPanningInertiaDecayModifier(): number {
    return this.PANNING_INERTIA_DECAY_MODIFIER_60HZ / (this.refreshRate / 60)
  }
}