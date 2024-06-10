import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { Map } from '@/Game/Map/Map'
import { MathX } from '@/Math/MathX'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { Line } from '@/Renderer/Sprite/Type/Line/Line'
import type { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import type { SpriteType } from '@/Renderer/Sprite/SpriteType'

export class GridSprite extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  private grid: SpriteInterface[] = []
  private isGridComplete: boolean = false

  constructor(
    private map: Map,
    private scale: number,
    spriteType: SpriteType
  ) {
    super(spriteType)
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    if (this.isGridComplete) {
      return this.grid
    }

    // this.createGrid()
    this.createBorder()
    // this.createBlocks()

    this.isGridComplete = true

    return this.grid
  }

  private createBlocks(): void {
    const x: number[] = MathX.range(this.scale, this.map.getWidth() - this.scale, this.scale)
    const y: number[] = MathX.range(this.scale, this.map.getHeight() - this.scale, this.scale)
    let c = 0

    for (let iy: number = 0; iy <= y.length; ++iy) {
      for (let ix: number = 0; ix <= x.length; ++ix) {
        const block = this.getFactory().createRectangle(
          new Vector(x[ix], y[iy]),
          this.scale + 1,
          this.scale + 1,
          this.randomColor()
        )

        if (this.randomNumber(0, 100) > 0) {
          this.grid.push(block)
        }

        ++c
      }
    }
  }

  private randomColor(): string {
    const red = this.randomNumber(32, 64).toString(16).padStart(2, '0')
    const gre = this.randomNumber(32, 127).toString(16).padStart(2, '0')
    const blu = this.randomNumber(32, 64).toString(16).padStart(2, '0')

    return '#' + red + gre + blu
  }

  private randomNumber(min: number, max: number): number {
    return Math.ceil(Math.random() * (max - min + 1) + min)
  }

  private createGrid(): void {
    // Render vertical grid lines
    const x: number[] = MathX.range(this.scale, this.map.getWidth() - this.scale, this.scale)

    for (let i: number = 0; i <= x.length - 1; ++i) {
      this.grid.push(this.getFactory().createLine(
        new Vector(x[i], 0),
        new Vector(x[i], this.map.getHeight()),
        1,
        '#ddd',
      ))
    }

    // Render horizontal grid lines
    const yStarts: number[] = MathX.range(this.scale, this.map.getHeight() - this.scale, this.scale)

    for (let i: number = 0; i <= yStarts.length - 1; ++i) {
      this.grid.push(this.getFactory().createLine(
        new Vector(0, yStarts[i]),
        new Vector(this.map.getWidth(), yStarts[i]),
        1,
        '#ddd',
      ))
    }
  }

  private createBorder(): void {
    const color: string = '#ccc'
    const borderWidth: number = 10

    // Render border left
    this.grid.push(this.getFactory().createLine(
      new Vector((0 - borderWidth / 2), (0 - borderWidth)),
      new Vector((0 - borderWidth / 2),this.map.getHeight() + borderWidth),
      borderWidth,
      color,
    ))

    // Render border top
    this.grid.push(this.getFactory().createLine(
      new Vector(0, (0 - borderWidth / 2)),
      new Vector(this.map.getWidth(), (0 - borderWidth / 2)),
      borderWidth,
      color,
    ))

    // Render border right
    this.grid.push(this.getFactory().createLine(
      new Vector((this.map.getWidth() + borderWidth / 2), (0 - borderWidth)),
      new Vector((this.map.getWidth() + borderWidth / 2),(this.map.getHeight() + borderWidth)),
      borderWidth,
      color,
    ))

    // Render border right
    this.grid.push(this.getFactory().createLine(
      new Vector((0 - borderWidth), (this.map.getHeight() + borderWidth / 2)),
      new Vector((this.map.getWidth()),(this.map.getHeight() + borderWidth / 2)),
      borderWidth,
      color,
    ))
  }
}