import { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'

export class Quadrant extends BoundingBox {
  private subQuadrants: Quadrant[] = []
  private sprites: SpriteInterface[] = []

  public getSubQuadrants(): Quadrant[] {
    return this.subQuadrants
  }

  public setSubQuadrants(quadrants: Quadrant[]): void {
    this.subQuadrants = quadrants
  }

  public isLeaf(): boolean {
    return this.subQuadrants.length === 0
  }

  public addSprite(sprite: SpriteInterface): void {
    this.sprites.push(sprite)
  }

  public getSprites(): SpriteInterface[] {
    return this.sprites
  }
}