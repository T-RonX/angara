import { AbstractSprite } from '@/Renderer/Sprite/AbstractSprite'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { Vector } from '@/Renderer/Positioning/Vector'

export class ProgressiveStaticImage extends AbstractSprite implements SpriteInterface {
  private lowResImage: ImageBitmap | null = null
  private highResImage: ImageBitmap | null = null
  private isLowResLoaded: boolean = false
  private isHighResLoaded: boolean = false

  constructor(
    public lowResSrc: string,
    public highResSrc: string,
    private position: Vector,
    private width: number,
    private height: number,
  ) {
    super()
    this.loadLowRes()
    this.loadHighRes()
  }

  private async loadLowRes() {
    const img = new Image()
    img.src = this.lowResSrc
    await img.decode()
    this.lowResImage = await createImageBitmap(img)
    this.isLowResLoaded = true
  }

  private async loadHighRes() {
    const img = new Image()
    img.src = this.highResSrc
    await img.decode()
    this.highResImage = await createImageBitmap(img)
    this.isHighResLoaded = true
  }

  public getPosition(): Vector {
    return this.position
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }

  public getCurrentImage(): ImageBitmap | null {
    return this.isHighResLoaded ? this.highResImage : this.lowResImage
  }

  public isLoaded(): boolean {
    return this.isLowResLoaded || this.isHighResLoaded
  }

  public getBoundingBox(): BoundingBox | null {
    const bottomRightCoord: Vector = new Vector(
      this.position.x + this.width,
      this.position.y + this.height
    )
    return new BoundingBox(this.position, bottomRightCoord)
  }
}
