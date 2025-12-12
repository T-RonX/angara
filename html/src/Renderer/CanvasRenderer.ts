import { RenderStack } from '@/Renderer/RenderStack/RenderStack'
import { DefaultFpsMonitor } from '@/Renderer/Monitor/Fps/DefaultFpsMonitor'
import { FpsSprite } from '@/Renderer/Monitor/Fps/FpsSprite'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { SpriteFactory } from '@/Renderer/Sprite/SpriteFactory'
import type { FpsMonitorInterface } from '@/Renderer/Monitor/Fps/FpsMonitorInterface'
import { SpatialPartitioning } from '@/Renderer/OcclusionCulling/SpatialPartitioning'
import { Quadrant } from '@/Renderer/OcclusionCulling/Quadrant'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import { MathX } from '@/Math/MathX'
import type { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'
import { Stopwatch } from '@/Renderer/Monitor/Timing/Stopwatch'

export class CanvasRenderer {
  private readonly fpsMonitor: DefaultFpsMonitor = new DefaultFpsMonitor()
  private ctx: CanvasRenderingContext2D
  private readonly renderStack: RenderStack = new RenderStack()
  private readonly spacialPartitioningOcclusion: SpatialPartitioning = new SpatialPartitioning()
  private doRender: boolean = true
  private occlusionTree: Quadrant = new Quadrant(new Vector(0, 0), new Vector(0, 0))
  private activeSprites: SpriteInterface[] = []
  private readonly activeIds: Set<number> = new Set()
  private stopwatch: Stopwatch = new Stopwatch()

  constructor(
    private showFps: boolean,
    private context: RenderContext,
    private spriteFactory: SpriteFactory,
    private spaceWidth: number,
    private spaceHeight: number,
  ) {
    this.ctx = this.getCanvasContext()

    // this.ctx.translate(0.5, 0.5)
    // this.sharpenCanvas()
  }

  private getCanvasContext(): CanvasRenderingContext2D {
    const ctx: CanvasRenderingContext2D|null = this.context.getCanvas().getContext('2d' /*, { alpha: false }*/)

    if (ctx === null) {
      throw new Error('Could not get rendering context from canvas.')
    }

    return ctx
  }

  public reloadCanvasContext(): void {
    this.ctx = this.getCanvasContext()
  }

  private sharpenCanvas(): void {
    // Get the DPR and size of the canvas
    const dpr: number = window.devicePixelRatio;
    const rect: DOMRect = this.ctx.canvas.getBoundingClientRect();

    // Set the "actual" size of the canvas
    this.ctx.canvas.width = rect.width * dpr;
    this.ctx.canvas.height = rect.height * dpr;

    // Scale the context to ensure correct drawing operations
    this.ctx.scale(dpr, dpr);

    // Set the "drawn" size of the canvas
    this.ctx.canvas.style.width = `${rect.width}px`;
    this.ctx.canvas.style.height = `${rect.height}px`;
  }

  private calculateQuadrantSize(): number {
    const rect: DOMRect = this.ctx.canvas.getBoundingClientRect();
    const dpr: number = window.devicePixelRatio;
    const smallestEdge: number = Math.min(rect.width, rect.height) * dpr

    return Math.trunc(smallestEdge / 1.6)
  }

  public initialize(): void {
    const targetSize: number = this.calculateQuadrantSize()

    this.occlusionTree = this.spacialPartitioningOcclusion.buildOcclusionTree(
      this.context,
      this.renderStack,
      this.spaceWidth,
      this.spaceHeight,
      targetSize,
    )

    this.context.setOcclusionTree(this.occlusionTree)
  }

  public render(): void {
    if (this.showFps) {
      const fpsRender: FpsSprite = new FpsSprite(this.fpsMonitor, SpriteType.Fixed).setFactory(this.spriteFactory)

      this.renderStack.addMonitor(this.fpsMonitor)
      this.renderStack.addSpriteGenerator(fpsRender)
    }

    this.renderLoop()
  }

  private renderLoop = (): void => {
    if (!this.doRender) {
      return
    }

    this.renderFrame()
  }

  private renderFrame(): void {

    this.resetActiveSprites()
    const count: number = this.activeSprites.length

    for (let i: number = 0; i < count; i++) {
      const sprite: SpriteInterface = this.activeSprites[i]

      if (sprite.hasAnimator()) {
        sprite.getAnimator().animate(sprite, this.context)
      }

      if (sprite.getDoRender()) {
        sprite.getTypeRenderer().render(this.ctx, sprite, this.context)
      }
    }

    for (let i: number = 0; i < this.renderStack.getMonitors().length; i += 1) {
      this.renderStack.getMonitors()[i].monitor()
    }

    window.requestAnimationFrame(this.renderLoop)
  }

  private resetActiveSprites(): void {
    const tree: Quadrant[] = this.occlusionTree.getSubQuadrants()
    this.activeIds.clear()
    this.activeSprites.length = 0

    this.setActiveQuadrantSprites(tree, this.context.getViewport().getBoundingBox(), this.activeIds)
    this.activeSprites.sort((a: SpriteInterface, b: SpriteInterface) => a.getId() - b.getId())
  }

  private setActiveQuadrantSprites(quadrants: Quadrant[], viewPort: BoundingBox, activeIds: Set<number>): void {
    for (let i: number = 0; i < quadrants.length; ++i) {
      const quadrant = quadrants[i]
      if (quadrant.isLeaf() && MathX.doesRectangleOverlap(quadrant, viewPort)) {
        const sprites: SpriteInterface[] = quadrant.getSprites()
        const spriteCount: number = sprites.length

        for (let j: number = 0; j < spriteCount; j++) {
          const sprite = sprites[j]
          if (MathX.doesRectangleOverlap(sprite.getBoundingBox(), viewPort)) {
            const spriteId = sprite.getId()
            if (!activeIds.has(spriteId)) {
              this.activeSprites.push(sprite)
              activeIds.add(spriteId)
            }
          }
        }
      } else if (!quadrant.isLeaf()) {
        this.setActiveQuadrantSprites(quadrant.getSubQuadrants(), viewPort, activeIds)
      }
    }
  }

  public stop(): void {
    this.doRender = false
  }

  public start(): void {
    if (!this.doRender) {
      this.doRender = true
      this.renderLoop()
    }
  }

  public step(): void {
    this.stop()
    this.renderFrame()
  }

  public getRenderStack(): RenderStack {
    return this.renderStack
  }

  public getActiveSprites(): SpriteInterface[] {
    return this.activeSprites
  }

  public getSpritesAtPoint(x: number, y: number): SpriteInterface[] {
    let quadrant: Quadrant = this.occlusionTree
    let subQuadrants: Quadrant[] = quadrant.getSubQuadrants()

    while(subQuadrants.length > 0) {
      let found: boolean = false
      for (let i: number = 0; i < subQuadrants.length; ++i) {
        if (MathX.isPointInRectangle(x, y, subQuadrants[i])) {
          quadrant = subQuadrants[i]
          subQuadrants = quadrant.getSubQuadrants()
          found = true
          break
        }
      }
      if (!found) { // Should not happen if point is within the map
        return []
      }
    }

    return quadrant.getSprites()
  }

  public getFpsMonitor(): FpsMonitorInterface {
    return this.fpsMonitor
  }
}
