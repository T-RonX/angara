import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { Quadrant } from '@/Renderer/OcclusionCulling/Quadrant'
import type { BoundingBox } from '@/Renderer/Positioning/BoundingBox'
import { AbstractAssetGenerator } from '@/Game/Assets/AbstractAssetGenerator'

export class OcclusionTreeSprite extends AbstractAssetGenerator implements SpriteGeneratorInterface {
  private grid: SpriteInterface[] = []
  private isGridComplete: boolean = false

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    if (this.isGridComplete) {
      return this.grid
    }

    this.createGrid(renderContext.getOcclusionTree())
    this.isGridComplete = true

    return this.grid
  }

  private createGrid(quadrant: Quadrant): void {



    const color: string = this.randomColor()

    if (quadrant.isLeaf())
    {
    // -
      this.grid.push(this.getFactory().createLine(new Vector(quadrant.topLeftX, quadrant.topLeftY), new Vector(quadrant.lowerRightX, quadrant.topLeftY), 1, color))
      // >|
      this.grid.push(this.getFactory().createLine(new Vector(quadrant.lowerRightX, quadrant.lowerRightY), new Vector(quadrant.lowerRightX, quadrant.lowerRightY), 1, color))
      // _
      this.grid.push(this.getFactory().createLine(new Vector(quadrant.lowerRightX, quadrant.lowerRightY), new Vector(quadrant.topLeftX, quadrant.lowerRightY), 1, color))
      // |<
      this.grid.push(this.getFactory().createLine(new Vector(quadrant.topLeftX, quadrant.lowerRightY), new Vector(quadrant.topLeftX, quadrant.topLeftY), 1, color))
    }

    const box: BoundingBox = quadrant
    //
    // this.grid.push(this.getFactory().createStaticText(`X: ${box.topLeftX} Y: ${box.topLeftY}`, new Vector(box.topLeftX + 10, box.topLeftY + 20), '12px Courier', '#fc3'))
    // this.grid.push(this.getFactory().createStaticText(`X: ${box.lowerRightX} Y: ${box.lowerRightY}`, new Vector(box.lowerRightX - 100, box.lowerRightY - 10), '12px Courier', '#fc3'))

    for (const subQuadrants of quadrant.getSubQuadrants()) {
      this.createGrid(subQuadrants)
    }
  }

  private randomColor(): string {
    return '#c19c3d';
    const red = this.randomNumber(0, 255).toString(16).padStart(2, '0')
    const gre = this.randomNumber(0, 255).toString(16).padStart(2, '0')
    const blu = this.randomNumber(0, 255).toString(16).padStart(2, '0')

    return '#' + red + gre + blu
  }

  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }
}