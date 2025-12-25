import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'
import type { AnimatorInterface } from '@/Renderer/Animation/AnimatorInterface'

export class AbstractSprite {
  private id: number = 0
  protected typeRenderer: TypeRendererInterface|null = null
  protected animator: AnimatorInterface|null = null
  protected doRender: boolean = true
  protected isSpriteVisible: boolean = false

  public setId(id: number): this {
    this.id = id

    return this
  }

  public getId(): number {
    return this.id
  }

  public setDoRender(doRender: boolean): this {
    this.doRender = doRender

    return this
  }

  public getDoRender(): boolean {
    return this.doRender
  }

  public setIsVisible(isVisible: boolean): this {
    this.isSpriteVisible = isVisible

    return this
  }

  public isVisible(): boolean {
    return this.isSpriteVisible
  }

  public setTypeRenderer(typeRenderer: TypeRendererInterface): this {
    this.typeRenderer = typeRenderer

    return this
  }

  public getTypeRenderer(): TypeRendererInterface {
    if (this.typeRenderer === null) {
      throw new Error('No renderer set.')
    }

    return this.typeRenderer
  }

  public setAnimator(animator: AnimatorInterface|null): this {
    this.animator = animator

    return this
  }

  public hasAnimator(): boolean {
    return this.animator !== null
  }

  public getAnimator(): AnimatorInterface {
    if (this.animator === null) {
      throw new Error('No animator set.')
    }

    return this.animator
  }

  public logType() {
    console.log(this.constructor.name, this.id)
  }
}
