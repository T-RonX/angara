import type { TypeRendererInterface } from '@/Renderer/Sprite/Type/TypeRendererInterface'

export class AbstractSprite {
  protected typeRenderer: TypeRendererInterface|null = null
  private id: number = 0

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

  public setId(id: number): this {
    this.id = id

    return this
  }

  public getId(): number {
    return this.id
  }
}