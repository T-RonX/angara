import { Map } from '@/Game/Map/Map'
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
import { PathRenderer } from '@/Renderer/Sprite/Type/Path/PathRenderer'
import { CenterArrow } from '@/Game/Sprite/CenterArrow'
import { BlockMouseMove } from '@/Game/Events/BlockMouseMove'
import { AssetFactory } from '@/Game/Assets/AssetFactory'
import { AssetStore } from '@/Game/Assets/AssetStore'

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

    const assetStore: AssetStore<any> = new AssetStore<any>()
    const assetFactory: AssetFactory = new AssetFactory(
      assetStore,
      new ClearCanvasRenderer(),
      new LineRenderer(),
      new RectangleRenderer(),
      new FixedTextRenderer(),
      new StaticTextRenderer(),
      new StaticImageRenderer(),
      new PathRenderer(),
    )

    const viewport: Viewport = new Viewport(this.canvas)

    this.renderContext = new RenderContext(this.canvas, viewport, viewportInnerWidth, viewportInnerHeight)

    this.renderer = new CanvasRenderer(this.showFps, this.renderContext, assetFactory, viewportInnerWidth, viewportInnerHeight)
    this.renderer.getRenderStack().addSpriteGenerator(new ClearCanvasSprite(SpriteType.Static).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new CenterImageSprite(SpriteType.Static, map).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new BlockSprite(SpriteType.Animated).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new GridSprite(map, this.mapScale, SpriteType.Static).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new OcclusionTreeSprite(SpriteType.Static).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new CenterArrow(SpriteType.Static).setFactory(assetFactory))
    this.renderer.initialize()

    this.camera = new Camera(this.renderContext, map)
    this.camera.setPosition(
      Math.trunc((viewportInnerWidth / 2) - (this.canvas.clientWidth / 2)),
      Math.trunc((viewportInnerHeight / 2) - (this.canvas.clientHeight / 2)),
    )

    const cameraMouseEvents: CameraMouseEvents = new CameraMouseEvents(this.camera)
    const blockClick: BlockClick = new BlockClick(this.canvas, viewport, this.renderer, this.camera, assetStore)
    const blockMouseMove: BlockMouseMove = new BlockMouseMove(this.canvas, viewport, this.renderer, this.camera)

    this.input = new Input(
      [],
      [cameraMouseEvents],
      [blockClick, cameraMouseEvents],
      [cameraMouseEvents, blockMouseMove],
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
