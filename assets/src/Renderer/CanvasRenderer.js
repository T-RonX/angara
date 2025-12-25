import { RenderStack } from '@/Renderer/RenderStack/RenderStack';
import { DefaultFpsMonitor } from '@/Renderer/Monitor/Fps/DefaultFpsMonitor';
import { FpsSprite } from '@/Renderer/Monitor/Fps/FpsSprite';
import { SpriteFactory } from '@/Renderer/Sprite/SpriteFactory';
import { SpatialPartitioning } from '@/Renderer/OcclusionCulling/SpatialPartitioning';
import { Quadrant } from '@/Renderer/OcclusionCulling/Quadrant';
import { SpriteType } from '@/Renderer/Sprite/SpriteType';
import { MathX } from '@/Math/MathX';
import { Vector } from '@/Renderer/Positioning/Vector';
import { Stopwatch } from '@/Renderer/Monitor/Timing/Stopwatch';
export class CanvasRenderer {
    showFps;
    context;
    spriteFactory;
    spaceWidth;
    spaceHeight;
    fpsMonitor = new DefaultFpsMonitor();
    ctx;
    renderStack = new RenderStack();
    spacialPartitioningOcclusion = new SpatialPartitioning();
    doRender = true;
    occlusionTree = new Quadrant(new Vector(0, 0), new Vector(0, 0));
    activeSprites = [];
    activeIds = new Set();
    stopwatch = new Stopwatch();
    requestAnimationFrameId = null;
    constructor(showFps, context, spriteFactory, spaceWidth, spaceHeight) {
        this.showFps = showFps;
        this.context = context;
        this.spriteFactory = spriteFactory;
        this.spaceWidth = spaceWidth;
        this.spaceHeight = spaceHeight;
        this.ctx = this.getCanvasContext();
        // this.ctx.translate(0.5, 0.5)
        // this.sharpenCanvas()
    }
    getCanvasContext() {
        const ctx = this.context.getCanvas().getContext('2d' /*, { alpha: false }*/);
        if (ctx === null) {
            throw new Error('Could not get rendering context from canvas.');
        }
        return ctx;
    }
    reloadCanvasContext() {
        this.ctx = this.getCanvasContext();
    }
    sharpenCanvas() {
        // Get the DPR and size of the canvas
        const dpr = window.devicePixelRatio;
        const rect = this.ctx.canvas.getBoundingClientRect();
        // Set the "actual" size of the canvas
        this.ctx.canvas.width = rect.width * dpr;
        this.ctx.canvas.height = rect.height * dpr;
        // Scale the context to ensure correct drawing operations
        this.ctx.scale(dpr, dpr);
        // Set the "drawn" size of the canvas
        this.ctx.canvas.style.width = `${rect.width}px`;
        this.ctx.canvas.style.height = `${rect.height}px`;
    }
    calculateQuadrantSize() {
        const rect = this.ctx.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        const smallestEdge = Math.min(rect.width, rect.height) * dpr;
        return Math.trunc(smallestEdge / 1.6);
    }
    initialize() {
        const targetSize = this.calculateQuadrantSize();
        this.occlusionTree = this.spacialPartitioningOcclusion.buildOcclusionTree(this.context, this.renderStack, this.spaceWidth, this.spaceHeight, targetSize);
        this.context.setOcclusionTree(this.occlusionTree);
    }
    render() {
        if (this.showFps) {
            const fpsRender = new FpsSprite(this.fpsMonitor, SpriteType.Fixed).setFactory(this.spriteFactory);
            this.renderStack.addMonitor(this.fpsMonitor);
            this.renderStack.addSpriteGenerator(fpsRender);
        }
        this.renderLoop();
    }
    renderLoop = () => {
        if (!this.doRender) {
            return;
        }
        this.renderFrame();
    };
    renderFrame() {
        this.resetActiveSprites();
        const count = this.activeSprites.length;
        for (let i = 0; i < count; i++) {
            const sprite = this.activeSprites[i];
            if (sprite.hasAnimator()) {
                sprite.getAnimator().animate(sprite, this.context);
            }
            if (sprite.getDoRender()) {
                sprite.getTypeRenderer().render(this.ctx, sprite, this.context);
            }
        }
        for (let i = 0; i < this.renderStack.getMonitors().length; i += 1) {
            this.renderStack.getMonitors()[i].monitor();
        }
        this.requestAnimationFrameId = window.requestAnimationFrame(() => this.renderLoop());
    }
    resetActiveSprites() {
        const tree = [this.occlusionTree];
        this.activeIds.clear();
        this.activeSprites.length = 0;
        this.setActiveQuadrantSprites(tree, this.context.getViewport().getBoundingBox(), this.activeIds);
        this.activeSprites.sort((a, b) => a.getId() - b.getId());
    }
    setActiveQuadrantSprites(quadrants, viewPort, activeIds) {
        for (let i = 0; i < quadrants.length; ++i) {
            const quadrant = quadrants[i];
            if (quadrant.isLeaf() && MathX.doesRectangleOverlap(quadrant, viewPort)) {
                const sprites = quadrant.getSprites();
                const spriteCount = sprites.length;
                for (let j = 0; j < spriteCount; j++) {
                    const sprite = sprites[j];
                    if (MathX.doesRectangleOverlap(sprite.getBoundingBox(), viewPort)) {
                        const spriteId = sprite.getId();
                        if (!activeIds.has(spriteId)) {
                            this.activeSprites.push(sprite);
                            activeIds.add(spriteId);
                        }
                    }
                }
            }
            else if (!quadrant.isLeaf()) {
                this.setActiveQuadrantSprites(quadrant.getSubQuadrants(), viewPort, activeIds);
            }
        }
    }
    stop() {
        this.doRender = false;
    }
    start() {
        if (!this.doRender) {
            this.doRender = true;
            this.renderLoop();
        }
    }
    step() {
        this.stop();
        this.renderFrame();
    }
    getRenderStack() {
        return this.renderStack;
    }
    getActiveSprites() {
        return this.activeSprites;
    }
    getSpritesAtPoint(x, y) {
        let quadrant = this.occlusionTree;
        let subQuadrants = quadrant.getSubQuadrants();
        while (subQuadrants.length > 0) {
            let found = false;
            for (let i = 0; i < subQuadrants.length; ++i) {
                if (MathX.isPointInRectangle(x, y, subQuadrants[i])) {
                    quadrant = subQuadrants[i];
                    subQuadrants = quadrant.getSubQuadrants();
                    found = true;
                    break;
                }
            }
            if (!found) { // Should not happen if point is within the map
                return [];
            }
        }
        return quadrant.getSprites();
    }
    getFpsMonitor() {
        return this.fpsMonitor;
    }
    reset() {
        this.cancelFrame();
        this.getRenderStack().reset();
        this.occlusionTree.reset();
    }
    cancelFrame() {
        if (this.requestAnimationFrameId !== null) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }
    }
}
