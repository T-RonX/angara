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
import { BlockMouseMove } from '@/Game/Events/BlockMouseMove'
import { AssetFactory } from '@/Game/Assets/AssetFactory'
import { AssetStore } from '@/Game/Assets/AssetStore'
import { State } from '@/Game/State/State'
import { CenterArrow } from '@/Game/Sprite/CenterArrow'

export class Game {
  private renderer: CanvasRenderer
  private renderContext: RenderContext
  private camera: Camera
  private input: Input
  private gameState: State

  constructor(
    private canvas: HTMLCanvasElement,
    private mapWidth: number,
    private mapHeight: number,
    private mapScale: number,
    private showFps: boolean,
  ) {
    this.init()
  }

  private init() {
    console.debug('Initializing game...')

    const viewportInnerWidth: number = this.mapWidth * this.mapScale
    const viewportInnerHeight: number = this.mapHeight * this.mapScale
    const map: Map = new Map(viewportInnerWidth, viewportInnerHeight)
    const assetStore: AssetStore<any> = new AssetStore<any>()
    this.gameState = new State(assetStore)

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
    // this.renderer.getRenderStack().addSpriteGenerator(new CenterImageSprite(SpriteType.Static, map).setFactory(assetFactory))
    // this.renderer.getRenderStack().addSpriteGenerator(new BlockSprite(SpriteType.Animated).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new GridSprite(map, this.mapScale, SpriteType.Static).setFactory(assetFactory))
    // this.renderer.getRenderStack().addSpriteGenerator(new OcclusionTreeSprite(SpriteType.Static).setFactory(assetFactory))
    this.renderer.getRenderStack().addSpriteGenerator(new CenterArrow(SpriteType.Static, this.gameState).setFactory(assetFactory))

    setTimeout(() => {
      console.debug('Initializing renderer...')
      this.renderer.initialize()
      console.debug('Renderer initialized')
    }, 0)

    this.camera = new Camera(this.renderContext, map)
    this.camera.setPosition(
      Math.trunc((viewportInnerWidth / 2) - (this.canvas.clientWidth / 2)),
      Math.trunc((viewportInnerHeight / 2) - (this.canvas.clientHeight / 2)),
    )

    const cameraMouseEvents: CameraMouseEvents = new CameraMouseEvents(this.camera)
    const blockClick: BlockClick = new BlockClick(this.canvas, viewport, this.renderer, this.camera, this.gameState)
    const blockMouseMove: BlockMouseMove = new BlockMouseMove(this.canvas, viewport, this.renderer, this.camera)

    this.input = new Input(
      [],
      [cameraMouseEvents],
      [blockClick, cameraMouseEvents],
      [cameraMouseEvents, blockMouseMove],
      [cameraMouseEvents],
    )
    this.input.initialize(this.canvas)

    console.debug('Game initialized')
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

  public reset() {
    console.debug('Resetting input...')
    this.input.reset()
    console.debug('Input reset')
    console.debug('Stopping Renderer...')
    this.renderer.stop()
    console.debug('Renderer stopped')
    console.debug('Resetting renderer...')
    this.renderer.reset()
    console.debug('Renderer reset')
  }

  public cancelFrame(): void {
    this.renderer.cancelFrame();
  }

  public getIsDragging(): boolean {
    return this.camera.getIsPanning()
  }

  public getFps(): number {
    return Math.trunc(this.renderer.getFpsMonitor().getFps())
  }
}
