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
  private MIN_INERTIA_PANNING_START_IDLE_TIMEOUT: number = 100

  /**
   * The duration in milliseconds over which to measure the velocity for inertia.
   */
  private PANNING_VELOCITY_MEASUREMENT_DURATION: number = 50

  private panningThreshold: [x: number, y: number] = [this.DRAG_THRESHOLD, this.DRAG_THRESHOLD]
  private panningHistory: {t: number, x: number, y: number}[] = []
  private isInertiaPanning: boolean = false
  private panningDirection: number = 0
  private panningVelocity: number = 0
  private isPanning: boolean = false
  private refreshRate: number = 60
  private lastFrameTime: number = 0
  private movementX: number = 0
  private movementY: number = 0
  private isRunning: boolean = false

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
    this.movementX = e.movementX
    this.movementY = e.movementY

    this.logPanningState()
  }

  /**
   * Calculates the panning momentum (speed and direction) and
   * sets it to the viewport
   */
  public setInertiaPanningParameters(): void {
    const now = performance.now()
    if (now - this.panningHistory[this.panningHistory.length - 1].t > this.MIN_INERTIA_PANNING_START_IDLE_TIMEOUT) {
      this.panningVelocity = 0
      return
    }

    const first = this.panningHistory.find(log => now - log.t <= this.PANNING_VELOCITY_MEASUREMENT_DURATION) ?? this.panningHistory[0]
    const last = this.panningHistory[this.panningHistory.length - 1]

    if (!first || first === last) {
      this.panningVelocity = 0
      return
    }

    const deltaTime = (last.t - first.t) / 1000 // time in seconds
    if (deltaTime <= 0) {
        this.panningVelocity = 0
        return
    }

    const deltaX = last.x - first.x
    const deltaY = last.y - first.y

    const velocityX = deltaX / deltaTime
    const velocityY = deltaY / deltaTime

    this.panningDirection = Math.atan2(velocityY, velocityX)
    this.panningVelocity = Math.sqrt(velocityX**2 + velocityY**2)
  }

  /**
   * Log the latest pointer move deltas. Used for calculating the speed and angle of inertia panning.
   */
  public logPanningState(): void {
    const now = performance.now()
    this.panningHistory.push({
      t: now,
      x: this.rendererContext.getViewport().getPosition().x,
      y: this.rendererContext.getViewport().getPosition().y,
    })

    // Keep the history buffer from growing too large
    if (this.panningHistory.length > 20) {
      this.panningHistory.shift()
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
      this.start()
    }
  }

  public initiateInertiaPanningWhenRequired(): void {
    const requireInertiaPanning: boolean = this.panningVelocity > 0

    if (requireInertiaPanning) {
      this.isInertiaPanning = true
      this.start()
    }
  }

  private update = (): void => {
    if (!this.isRunning) {
      return
    }

    const now = performance.now()
    const deltaTime = (now - this.lastFrameTime) / 1000 // Time in seconds
    this.lastFrameTime = now

    let newX = this.rendererContext.getViewport().getPosition().x
    let newY = this.rendererContext.getViewport().getPosition().y

    // Handle direct panning
    if (this.isPanning) {
      newX -= this.movementX
      newY -= this.movementY
      this.movementX = 0
      this.movementY = 0
    }
    // Handle inertia panning
    else if (this.isInertiaPanning) {
      const deltaX: number = this.panningVelocity * Math.cos(this.panningDirection)
      const deltaY: number = this.panningVelocity * Math.sin(this.panningDirection)

      newX += deltaX * deltaTime
      newY += deltaY * deltaTime

      // Exponential damping
      const dampingFactor = 0.95; // Adjust this value for more or less damping
      this.panningVelocity *= Math.pow(dampingFactor, deltaTime * 60); // Normalize to 60 FPS

      if (this.panningVelocity < 1){
        this.panningVelocity = 0
        this.isInertiaPanning = false
      }
    }

    // Clamp position to boundaries
    newX = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(newX, -this.MAX_CAMERA_OVERFLOW, this.map.getWidth() - this.rendererContext.getCanvas().width + this.MAX_CAMERA_OVERFLOW))
    newY = Math.max(-this.MAX_CAMERA_OVERFLOW, MathX.clamp(newY, -this.MAX_CAMERA_OVERFLOW, this.map.getHeight() - this.rendererContext.getCanvas().height + this.MAX_CAMERA_OVERFLOW))

    this.rendererContext.getViewport().getPosition().x = newX
    this.rendererContext.getViewport().getPosition().y = newY

    if (!this.isPanning && !this.isInertiaPanning) {
      this.stop()
    } else {
      window.requestAnimationFrame(this.update)
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
    this.movementX = 0
    this.movementY = 0
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

  public start(): void {
    if (!this.isRunning) {
      this.isRunning = true
      this.lastFrameTime = performance.now()
      window.requestAnimationFrame(this.update)
    }
  }

  public stop(): void {
    this.isRunning = false
  }
}