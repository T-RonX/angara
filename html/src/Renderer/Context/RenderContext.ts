import type { Viewport } from '@/Renderer/Viewport/Viewport'
import type { Quadrant } from '@/Renderer/OcclusionCulling/Quadrant'
import { Stopwatch } from '@/Renderer/Monitor/Timing/Stopwatch'

export class RenderContext {
  private occlusionTree: Quadrant|null = null
  private timer: Stopwatch = new Stopwatch()

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
  ) {
  }

  public setCanvas(canvas: HTMLCanvasElement): void  {
    this.canvas = canvas
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  public getViewport(): Viewport {
    return this.viewport
  }

  public setOcclusionTree(quadrant: Quadrant): void {
    this.occlusionTree = quadrant
  }

  public getOcclusionTree(): Quadrant {
    if (this.occlusionTree === null) {
      throw new Error('No occlusion tree set.')
    }

    return this.occlusionTree
  }

  public getStopwatch(): Stopwatch {
    return this.timer
  }
}
