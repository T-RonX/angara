import type { FpsMonitorInterface } from '@/Renderer/Monitor/Fps/FpsMonitorInterface'

export class DefaultFpsMonitor implements FpsMonitorInterface {
  private lastCalledTime: DOMHighResTimeStamp[] = []
  private fps: number = 0

  constructor() {
    this.reset()
  }

  private reset(): void {
    this.lastCalledTime = []
    this.fps = 0;
  }

  public monitor(): void {
    const now = performance.now()
    this.lastCalledTime.push(now)

    this.lastCalledTime = this.lastCalledTime.filter(time => now - time <= 2000)

    const deltaTime = now - this.lastCalledTime[0]
    this.fps = this.lastCalledTime.length / (deltaTime / 1000)
  }

  public getFps(): number {
    return this.fps
  }

  public getFrameTime(): number {
    return this.fps
  }
}