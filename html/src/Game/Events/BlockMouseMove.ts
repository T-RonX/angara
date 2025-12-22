import type { Viewport } from '@/Renderer/Viewport/Viewport'
import type { CanvasRenderer } from '@/Renderer/CanvasRenderer'
import { MathX } from '@/Math/MathX'
import type { Camera } from '@/Game/Camera/Camera'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import type { CanvasMouseMoveInterface } from '@/Game/Input/CanvasMouseMoveInterface'
import type { SelectableInterface } from '@/Game/Input/SelectableInterface'
import { MapCellAsset } from '@/Game/Assets/MapCellAsset'
import type { State } from '@/Game/State/State'

export class BlockMouseMove implements CanvasMouseMoveInterface
{
    private previousSprite: MapCellAsset | null = null

    constructor(
        private canvas: HTMLCanvasElement,
        private viewport: Viewport,
        private renderer: CanvasRenderer,
        private camera: Camera,
        private gameState: State,
    )
    {
    }

    public onMouseMove(e: MouseEvent): void
    {
        if (this.camera.getIsPanning())
        {
            return
        }

        const rect: DOMRect = this.canvas.getBoundingClientRect()
        const x: number = Math.round(e.clientX - rect.left + this.viewport.getPosition().x)
        const y: number = Math.round(e.clientY - rect.top + this.viewport.getPosition().y)

        const sprites: SpriteInterface[] = this.renderer.getSpritesAtPoint(x, y)

        if (this.gameState.hasSelectedAsset() && MathX.isPointInRectangle(x, y, this.gameState.getSelectedAsset().getBoundingBox()))
        {
            this.canvas.style.cursor = 'pointer'
            return;
        }
        else
        {
            this.canvas.style.cursor = 'auto'
        }

        for (const sprite of sprites)
        {
            if (!(sprite instanceof MapCellAsset))
            {
                continue;
            }

            if (this.gameState.isSelectedAssetId(sprite.getId()))
            {
                continue;
            }

            if (MathX.isPointInRectangle(x, y, sprite.getBoundingBox()))
            {
                sprite.setIsVisible(true)
                sprite.setColor('rgba(34,135,166, .1)')

                if (this.previousSprite !== null && this.previousSprite !== sprite && !this.gameState.isSelectedAssetId(this.previousSprite.getId()))
                {
                    this.previousSprite.setIsVisible(false)
                }

                this.previousSprite = sprite
                break;
            }

        }
    }

    private isSelectable(sprite: SpriteInterface | SelectableInterface): sprite is SelectableInterface
    {
        return (sprite as SelectableInterface)?.isSelectable !== undefined
    }
}
