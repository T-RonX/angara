import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Quadrant } from '@/Renderer/OcclusionCulling/Quadrant'
import { Vector } from '@/Renderer/Positioning/Vector'
import { SpriteType } from '@/Renderer/Sprite/SpriteType'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { RenderStack } from '@/Renderer/RenderStack/RenderStack'
import { MathX } from '@/Math/MathX'

export class SpatialPartitioning {
  public buildOcclusionTree(context: RenderContext, renderStack: RenderStack, spaceWith: number, spaceHeight: number, targetSize: number): Quadrant {
    const occlusionTree: Quadrant = this.buildQuadrantTree(spaceWith, spaceHeight, targetSize)
    const sprites: SpriteInterface[] = []
    context.setOcclusionTree(occlusionTree)

    for (const generator of renderStack.getSpriteGenerators().filter((renderer) => renderer.getSpriteType() === SpriteType.Static)) {
      const r = generator.getSprites(context);
      const rleng = r.length

      for (let i = 0; i < rleng; ++i) {
        sprites.push(r[i])
      }
    }

    for (const sprite of sprites) {
      this.assignSpritesToQuadrants(sprite, occlusionTree.getSubQuadrants())
    }

    return occlusionTree
  }

  public buildQuadrantTree(spaceWith: number, spaceHeight: number, targetSize: number): Quadrant {
    // Add some default margin to avoid potential overlap issues
    spaceWith += 4
    spaceHeight += 4

    // How much space add to the original space to be able to divide equally by target size
    const widthExpand: number = (targetSize - (spaceWith -(Math.trunc(spaceWith / targetSize) * targetSize))) / 2
    const heightExpand: number = (targetSize - (spaceHeight - (Math.trunc(spaceHeight / targetSize) * targetSize))) / 2

    // If uneven space to add (always .5), add 1 to just one side by 1 instead 0.5 on both sides
    const widthStretch: number = (widthExpand - Math.trunc(widthExpand)) * 2
    const heightStretch: number = (heightExpand - Math.trunc(heightExpand)) * 2

    // Vector for the new expanded space
    const topLeftX: number = -Math.trunc(widthExpand)
    const topLeftY: number = -Math.trunc(heightExpand)
    const lowerRightX: number = Math.trunc(widthExpand) + widthStretch + spaceWith
    const lowerRightY: number = Math.trunc(heightExpand) + heightStretch + spaceHeight

    const fullSpaceQuadrant: Quadrant = new Quadrant(new Vector(topLeftX, topLeftY), new Vector(lowerRightX, lowerRightY))
    this.buildQuadrantTreeItems(fullSpaceQuadrant, targetSize, 1)

    return fullSpaceQuadrant
  }

  private buildQuadrantTreeItems(quadrant: Quadrant, targetSize: number, level: number): void {
    if (level > 99) {
      throw new Error('Spatial partitioning nested too deep')
    }

    const spaceWith: number = quadrant.lowerRightX - quadrant.topLeftX
    const spaceHeight: number = quadrant.lowerRightY - quadrant.topLeftY

    if (spaceWith > targetSize || spaceHeight > targetSize)
    {
      const quadrants: Quadrant[] = this.calculateQuadrants(quadrant)

      this.buildQuadrantTreeItems(quadrants[0], targetSize, level + 1)
      this.buildQuadrantTreeItems(quadrants[1], targetSize, level + 1)
      this.buildQuadrantTreeItems(quadrants[2], targetSize, level + 1)
      this.buildQuadrantTreeItems(quadrants[3], targetSize, level + 1)

      quadrant.setSubQuadrants(quadrants);
    }
  }

  private calculateQuadrants(q: Quadrant): Quadrant[] {
    const spaceWidth: number = q.lowerRightX - q.topLeftX
    const spaceHeight: number = q.lowerRightY - q.topLeftY

    const qWith = Math.round(spaceWidth / 2)
    const qHeight = Math.round(spaceHeight / 2)

    const quadrants: Quadrant[] = [
      new Quadrant(new Vector(0, 0), new Vector(Math.round(qWith) - 1, Math.round(qHeight) - 1)),
      new Quadrant(new Vector(Math.round(qWith), 0), new Vector(Math.round(qWith * 2), Math.round(qHeight) - 1)),
      new Quadrant(new Vector(0, Math.round(qHeight)), new Vector(Math.round(qWith - 1), Math.round(qHeight * 2))),
      new Quadrant(new Vector(Math.round(qWith), Math.round(qHeight)), new Vector(Math.round(qWith * 2), Math.round(qHeight * 2))),
    ]

    quadrants[0].topLeftX += q.topLeftX
    quadrants[0].topLeftY += q.topLeftY
    quadrants[0].lowerRightX += q.topLeftX
    quadrants[0].lowerRightY += q.topLeftY

    quadrants[1].topLeftX += q.topLeftX
    quadrants[1].topLeftY += q.topLeftY
    quadrants[1].lowerRightX += q.topLeftX
    quadrants[1].lowerRightY += q.topLeftY

    quadrants[2].topLeftX += q.topLeftX
    quadrants[2].topLeftY += q.topLeftY
    quadrants[2].lowerRightX += q.topLeftX
    quadrants[2].lowerRightY += q.topLeftY

    quadrants[3].topLeftX += q.topLeftX
    quadrants[3].topLeftY += q.topLeftY
    quadrants[3].lowerRightX += q.topLeftX
    quadrants[3].lowerRightY += q.topLeftY

    return quadrants
  }

  private assignSpritesToQuadrants(sprite: SpriteInterface, quadrants: Quadrant[]): void {
    for (let i: number = 0; i < 4; ++i) {
      if (MathX.doesRectangleOverlap(sprite.getBoundingBox(), quadrants[i])) {
        if (quadrants[i].isLeaf()) {
          quadrants[i].addSprite(sprite)
        } else {
          this.assignSpritesToQuadrants(sprite, quadrants[i].getSubQuadrants())
        }
      }
    }
  }
}
