import { Map } from '@/Game/Map/Map';
import { LineRenderer } from '@/Renderer/Sprite/Type/Line/LineRenderer';
import { ClearCanvasRenderer } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvasRenderer';
import { RectangleRenderer } from '@/Renderer/Sprite/Type/Rectangle/RectangleRenderer';
import { FixedTextRenderer } from '@/Renderer/Sprite/Type/Text/FixedTextRenderer';
import { RenderContext } from '@/Renderer/Context/RenderContext';
import { CanvasRenderer } from '@/Renderer/CanvasRenderer';
import { ClearCanvasSprite } from '@/Renderer/Sprite/Generator/Default/ClearCanvasSprite';
import { GridSprite } from '@/Game/Sprite/GridSprite';
import { BlockSprite } from '@/Game/Sprite/BlockSprite';
import { Viewport } from '@/Renderer/Viewport/Viewport';
import { Camera } from '@/Game/Camera/Camera';
import { OcclusionTreeSprite } from '@/Game/Sprite/OcclusionTreeSprite';
import { SpriteType } from '@/Renderer/Sprite/SpriteType';
import { StaticTextRenderer } from '@/Renderer/Sprite/Type/Text/StaticTextRenderer';
import { StaticImageRenderer } from '@/Renderer/Sprite/Type/Image/StaticImageRenderer';
import { CenterImageSprite } from '@/Game/Sprite/CenterImageSprite';
import { Input } from '@/Game/Input/Input';
import { CameraMouseEvents } from '@/Game/Camera/CameraMouseEvents';
import { MapCellClick } from '@/Game/Events/MapCellClick';
import { PathRenderer } from '@/Renderer/Sprite/Type/Path/PathRenderer';
import { BlockMouseMove } from '@/Game/Events/BlockMouseMove';
import { AssetFactory } from '@/Game/Assets/AssetFactory';
import { AssetStore } from '@/Game/Assets/AssetStore';
import { State } from '@/Game/State/State';
import { CenterArrow } from '@/Game/Sprite/CenterArrow';
export class Game {
    canvas;
    mapWidth;
    mapHeight;
    mapScale;
    showFps;
    renderer;
    renderContext;
    camera;
    input;
    gameState;
    constructor(canvas, mapWidth, mapHeight, mapScale, showFps) {
        this.canvas = canvas;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.mapScale = mapScale;
        this.showFps = showFps;
        this.init();
    }
    getRenderer() {
        if (this.renderer == undefined) {
            throw new Error();
        }
        return this.renderer;
    }
    getRenderContext() {
        if (this.renderContext == undefined) {
            throw new Error();
        }
        return this.renderContext;
    }
    getCamera() {
        if (this.camera == undefined) {
            throw new Error();
        }
        return this.camera;
    }
    getInput() {
        if (this.input == undefined) {
            throw new Error();
        }
        return this.input;
    }
    getGameState() {
        if (this.gameState == undefined) {
            throw new Error();
        }
        return this.gameState;
    }
    init() {
        console.debug('Initializing game...');
        const viewportInnerWidth = this.mapWidth * this.mapScale;
        const viewportInnerHeight = this.mapHeight * this.mapScale;
        const map = new Map(viewportInnerWidth, viewportInnerHeight);
        const assetStore = new AssetStore();
        this.gameState = new State(assetStore);
        const assetFactory = new AssetFactory(assetStore, new ClearCanvasRenderer(), new LineRenderer(), new RectangleRenderer(), new FixedTextRenderer(), new StaticTextRenderer(), new StaticImageRenderer(), new PathRenderer());
        const viewport = new Viewport(this.canvas);
        this.renderContext = new RenderContext(this.canvas, viewport, viewportInnerWidth, viewportInnerHeight);
        this.renderer = new CanvasRenderer(this.showFps, this.renderContext, assetFactory, viewportInnerWidth, viewportInnerHeight);
        this.renderer.getRenderStack().addSpriteGenerator(new ClearCanvasSprite(SpriteType.Static).setFactory(assetFactory));
        // this.renderer.getRenderStack().addSpriteGenerator(new CenterImageSprite(SpriteType.Static, map).setFactory(assetFactory))
        // this.renderer.getRenderStack().addSpriteGenerator(new BlockSprite(SpriteType.Animated).setFactory(assetFactory))
        this.renderer.getRenderStack().addSpriteGenerator(new GridSprite(map, this.mapScale, SpriteType.Static).setFactory(assetFactory));
        // this.renderer.getRenderStack().addSpriteGenerator(new OcclusionTreeSprite(SpriteType.Static).setFactory(assetFactory))
        this.renderer.getRenderStack().addSpriteGenerator(new CenterArrow(SpriteType.Static, this.gameState).setFactory(assetFactory));
        setTimeout(() => {
            console.debug('Initializing renderer...');
            this.getRenderer().initialize();
            console.debug('Renderer initialized');
        }, 0);
        this.camera = new Camera(this.renderContext, map);
        this.camera.setPosition(Math.trunc((viewportInnerWidth / 2) - (this.canvas.clientWidth / 2)), Math.trunc((viewportInnerHeight / 2) - (this.canvas.clientHeight / 2)));
        const cameraMouseEvents = new CameraMouseEvents(this.camera);
        const mapCellClick = new MapCellClick(this.canvas, viewport, this.renderer, this.camera, this.gameState);
        const blockMouseMove = new BlockMouseMove(this.canvas, viewport, this.renderer, this.camera, this.gameState);
        this.input = new Input([], [cameraMouseEvents], [mapCellClick, cameraMouseEvents], [cameraMouseEvents, blockMouseMove], [cameraMouseEvents]);
        this.input.initialize(this.canvas);
        console.debug('Game initialized');
    }
    monitorFps() {
        const fpsUpdater = () => {
            this.getCamera().setRefreshRate(Math.trunc(this.getRenderer().getFpsMonitor().getFps()));
            setTimeout(fpsUpdater, 1000);
        };
        fpsUpdater();
    }
    setCanvasHooks(canvas) {
        this.getRenderContext().setCanvas(canvas);
        this.getRenderer().reloadCanvasContext();
        this.getInput().initialize(this.getRenderContext().getCanvas());
    }
    render() {
        try {
            this.monitorFps();
            this.getRenderer().render();
        }
        catch (e) {
            this.getRenderer().stop();
            console.error(e);
        }
    }
    stopRendering() {
        this.getRenderer().stop();
    }
    continueRendering() {
        this.getRenderer().start();
    }
    stepRendering() {
        this.getRenderer().step();
    }
    reset() {
        console.debug('Resetting input...');
        this.getInput().reset();
        console.debug('Input reset');
        console.debug('Stopping Renderer...');
        this.getRenderer().stop();
        console.debug('Renderer stopped');
        console.debug('Resetting renderer...');
        this.getRenderer().reset();
        console.debug('Renderer reset');
    }
    cancelFrame() {
        this.getRenderer().cancelFrame();
    }
    getIsDragging() {
        return this.getCamera().getIsPanning();
    }
    getFps() {
        return Math.trunc(this.getRenderer().getFpsMonitor().getFps());
    }
}
