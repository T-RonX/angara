import type { LineRenderer } from '@/Renderer/Sprite/Type/Line/LineRenderer'
import { Line } from '@/Renderer/Sprite/Type/Line/Line'
import { Image } from '@/Renderer/Sprite/Type/Image/Image'
import { Vector } from '@/Renderer/Positioning/Vector'
import { RectangleRenderer } from '@/Renderer/Sprite/Type/Rectangle/RectangleRenderer'
import { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import { Text } from '@/Renderer/Sprite/Type/Text/Text'
import type { FixedTextRenderer } from '@/Renderer/Sprite/Type/Text/FixedTextRenderer'
import type { ClearCanvasRenderer } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvasRenderer'
import { ClearCanvas } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvas'
import { IdGenerator } from '@/Renderer/RenderStack/IdGenerator'
import type { StaticTextRenderer } from '@/Renderer/Sprite/Type/Text/StaticTextRenderer'
import type { StaticImageRenderer } from '@/Renderer/Sprite/Type/Image/StaticImageRenderer'

export class SpriteFactory {
  private idGenerator: IdGenerator = new IdGenerator()

  constructor(
    private clearCanvasRenderer: ClearCanvasRenderer,
    private lineRenderer: LineRenderer,
    private rectangleRenderer: RectangleRenderer,
    private fixedTextRenderer: FixedTextRenderer,
    private staticTextRenderer: StaticTextRenderer,
    private staticImageRenderer: StaticImageRenderer,
  ) {
  }

  public createClearCanvas(to: number, from: number, width: number, height: number): ClearCanvas {
    return new ClearCanvas(to, from, width, height)
      .setTypeRenderer(this.clearCanvasRenderer)
      .setId(this.idGenerator.getNextId())
  }

  public createLine(from: Vector, to: Vector, width: number, color: string): Line {
    return new Line(to, from, width, color)
      .setTypeRenderer(this.lineRenderer)
      .setId(this.idGenerator.getNextId())
  }

  public createRectangle(topLeft: Vector, width: number, height: number, color: string): Rectangle {
    return new Rectangle(topLeft, width, height, color)
      .setTypeRenderer(this.rectangleRenderer)
      .setId(this.idGenerator.getNextId())
  }

  public createFixedText(text: string, position: Vector, font: string, color: string): Text {
    return new Text(text, position, font, color)
      .setTypeRenderer(this.fixedTextRenderer)
      .setId(this.idGenerator.getNextId())
  }

  public createStaticText(text: string, position: Vector, font: string, color: string): Text {
    return new Text(text, position, font, color)
      .setTypeRenderer(this.staticTextRenderer)
      .setId(this.idGenerator.getNextId())
  }

  public createStaticImage(src: string, position: Vector, width: number, height: number): Image {
    return new Image(src, position, width, height)
      .setTypeRenderer(this.staticImageRenderer)
      .setId(this.idGenerator.getNextId())
  }
}