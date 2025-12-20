import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class StaticImage extends AbstractSprite implements SpriteInterface {
  private image: HTMLImageElement
  private bitmap: ImageBitmap | null = null
  private isLoaded: boolean = false
  private loadPromise: Promise<void>

  constructor(
    public src: string,
    private position: Vector,
    private width: number,
    private height: number,
    private sourceX: number,
    private sourceY: number,
    private sourceWidth: number,
    private sourceHeight: number,
  ) {
    super()

    this.image = new Image()
    this.loadPromise = new Promise((resolve) => {
      this.image.onload = async () => {
        this.bitmap = await createImageBitmap(this.image)
        this.isLoaded = true
        resolve()
      }
    })
    this.image.src = src
  }

  public getPosition(): Vector {
    return this.position
  }

  public getSrc(): string {
    return this.src
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }

  public getSourceX(): number {
    return this.sourceX
  }

  public getSourceY(): number {
    return this.sourceY
  }

  public getSourceWidth(): number {
    return this.sourceWidth
  }

  public getSourceHeight(): number {
    return this.sourceHeight
  }

  public getBitmap(): ImageBitmap | null {
    return this.bitmap
  }

  public isImageLoaded(): boolean {
    return this.isLoaded
  }

  public async waitForLoad(): Promise<void> {
    return this.loadPromise
  }

  public getBoundingBox(): BoundingBox | null {
    const bottomRightX: number = this.position.x + this.width
    const bottomRightY: number = this.position.y + this.height

    const bottomRightCoord: Vector = new Vector(bottomRightX, bottomRightY)

    return new BoundingBox(this.position, bottomRightCoord)
  }
}