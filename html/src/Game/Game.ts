import { Map } from '@/Game/Map/Map'
import { SpriteFactory } from '@/Renderer/Sprite/SpriteFactory'
import { LineRenderer } from '@/Renderer/Sprite/Type/Line/LineRenderer'
import { ClearCanvasRenderer } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvasRenderer'
import { RectangleRenderer } from '@/Renderer/Sprite/Type/Rectangle/RectangleRenderer'
import { FixedTextRenderer } from '@/Renderer/Sprite/Type/Text/FixedTextRenderer'
import { RenderContext } from '@/Renderer/Context/RenderContext'
import { CanvasRenderer } from '@/Renderer/CanvasRenderer'
import { ClearCanvasSprite } from '@/Renderer/Sprite/Generator/Default/ClearCanvasSprite'
import { GridSprite } from '@/Game/Sprite/GridSprite'
import { BlockSprite } from '@/Game/Sprite/BlockSprite'
import { Viewport } from '@/Renderer/Viewport/Viewport'
import { Camera } from '@/Game/Camera/Camera'
import { OcclusionTreeSprite } from '@/Game/Sprite/OcclusionTreeSprite'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import { StaticTextRenderer } from '@/Renderer/Sprite/Type/Text/StaticTextRenderer'
import { StaticImageRenderer } from '@/Renderer/Sprite/Type/Image/StaticImageRenderer'
import { CenterImageSprite } from '@/Game/Sprite/CenterImageSprite'
import { Input } from '@/Game/Input/Input'
import { CameraMouseEvents } from '@/Game/Camera/CameraMouseEvents'
import { BlockClick } from '@/Game/Events/BlockClick'

export class Game {
  private readonly renderer: CanvasRenderer
  private readonly renderContext: RenderContext
  private readonly camera: Camera
  private readonly input: Input

  constructor(
    private canvas: HTMLCanvasElement,
    mapWidth: number,
    mapHeight: number,
    private mapScale: number,
    private showFps: boolean,
  ) {
    const viewportInnerWidth: number = mapWidth * mapScale
    const viewportInnerHeight: number = mapHeight * mapScale
    const map: Map = new Map(viewportInnerWidth, viewportInnerHeight)

    const spriteFactory: SpriteFactory = new SpriteFactory(
      new ClearCanvasRenderer(),
      new LineRenderer(),
      new RectangleRenderer(),
      new FixedTextRenderer(),
      new StaticTextRenderer(),
      new StaticImageRenderer(),
    )

    const viewport: Viewport = new Viewport(this.canvas)

    this.renderContext = new RenderContext(this.canvas, viewport)

    this.renderer = new CanvasRenderer(this.showFps, this.renderContext, spriteFactory, viewportInnerWidth, viewportInnerHeight)
    this.renderer.getRenderStack().addSpriteGenerator(new ClearCanvasSprite(SpriteType.Static).setFactory(spriteFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new CenterImageSprite(SpriteType.Static, map).setFactory(spriteFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new BlockSprite(SpriteType.Animated).setFactory(spriteFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new GridSprite(map, this.mapScale, SpriteType.Static).setFactory(spriteFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new OcclusionTreeSprite(SpriteType.Static).setFactory(spriteFactory))
    this.renderer.initialize()

    this.camera = new Camera(this.renderContext, map)
    this.camera.setInitialPosition()

    const cameraMouseEvents: CameraMouseEvents = new CameraMouseEvents(this.camera)
    const blockClick: BlockClick = new BlockClick(this.canvas, viewport, this.renderer, this.camera)

    this.input = new Input(
      [],
      [cameraMouseEvents],
      [blockClick, cameraMouseEvents],
      [cameraMouseEvents],
      [cameraMouseEvents],
    )
    this.input.initialize(this.canvas)
  }

  private monitorFps() {
    const fpsUpdater = () => {
      this.camera.setRefreshRate(Math.trunc(this.renderer.getFpsMonitor().getFps()))
      setTimeout(fpsUpdater, 1000)
    }

    fpsUpdater()
  }

  public setCanvasHooks(canvas: HTMLCanvasElement): void {
    this.renderContext.setCanvas(canvas)
    this.renderer.reloadCanvasContext()
    this.input.initialize(this.renderContext.getCanvas())
  }

  public render(): void {
    try {
      this.monitorFps()
      this.renderer.render()
    } catch (e) {
      this.renderer.stop()
      console.error(e)
    }
  }

  public stopRendering() {
    this.renderer.stop()
  }

  public continueRendering() {
    this.renderer.start()
  }

  public stepRendering() {
    this.renderer.step()
  }

  public getIsDragging(): boolean {
    return this.camera.getIsPanning()
  }

  public getFps(): number {
    return Math.trunc(this.renderer.getFpsMonitor().getFps())
  }
}
