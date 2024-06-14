import type { AnimatorInterface } from '@/Renderer/Animation/AnimatorInterface'

export class SpriteAnimators {
  private sprites: Record<number, AnimatorInterface> = {}

  public hasId(id: number): boolean {
    return id in this.sprites
  }

  public getAnimator(id: number): AnimatorInterface {
    if (this.hasId(id)) {
      return this.sprites[id]
    } else {
      throw new Error(`Sprite with id ${id} not found`)
    }
  }

  public addAnimator(id: number, sprite: AnimatorInterface): void {
    this.sprites[id] = sprite
  }
}
