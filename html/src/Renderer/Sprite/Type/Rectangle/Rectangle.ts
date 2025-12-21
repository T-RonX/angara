import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class Rectangle extends AbstractSprite implements SpriteInterface
{
    private cachedBoundingBox: BoundingBox | null = null

    constructor(
        public topLeft: Vector,
        private width: number,
        private height: number,
        private color: string,
        isSpriteVisible: boolean = false,
        private roundedCorners: number = 0,
    )
    {
        super()
        this.setIsVisible(isSpriteVisible)
    }

    public getTopLeft(): Vector
    {
        return this.topLeft
    }

    public getWidth(): number
    {
        return this.width
    }

    public getHeight(): number
    {
        return this.height
    }

    public getColor(): string
    {
        return this.color
    }

    public getRoundedCorners(): number
    {
        return this.roundedCorners
    }

    private oldColor: string = ''

    public setColor(color: string): void
    {
        this.color = color
    }

    public toggleColor(color: string = ''): void
    {
        if (this.oldColor === '')
        {
            this.oldColor = this.color
            this.color = color
        }
        else
        {
            this.color = this.oldColor
            this.oldColor = ''
        }
    }

    public invalidateBoundingBox(): void
    {
        this.cachedBoundingBox = null
    }

    public getBoundingBox(): BoundingBox | null
    {
        if (this.cachedBoundingBox)
        {
            return this.cachedBoundingBox
        }

        const bottomRightCoord: Vector = new Vector(this.topLeft.x + this.width, this.topLeft.y + this.height)
        this.cachedBoundingBox = new BoundingBox(this.topLeft, bottomRightCoord)
        
        return this.cachedBoundingBox
    }
}
