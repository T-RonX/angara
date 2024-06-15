import { SpriteFactory } from '@/Renderer/Sprite/SpriteFactory'
import { Vector } from '@/Renderer/Positioning/Vector'
import { MapBlockAsset } from '@/Game/Assets/MapBlockAsset'
import type { AssetStore } from '@/Game/Assets/AssetStore'
import type { ClearCanvasRenderer } from '@/Renderer/Sprite/Type/ClearCanvas/ClearCanvasRenderer'
import type { LineRenderer } from '@/Renderer/Sprite/Type/Line/LineRenderer'
import { RectangleRenderer } from '@/Renderer/Sprite/Type/Rectangle/RectangleRenderer'
import type { FixedTextRenderer } from '@/Renderer/Sprite/Type/Text/FixedTextRenderer'
import type { StaticTextRenderer } from '@/Renderer/Sprite/Type/Text/StaticTextRenderer'
import type { StaticImageRenderer } from '@/Renderer/Sprite/Type/Image/StaticImageRenderer'
import type { PathRenderer } from '@/Renderer/Sprite/Type/Path/PathRenderer'

export class AssetFactory extends SpriteFactory {
  constructor(
    private assets: AssetStore<any>,
    clearCanvasRenderer: ClearCanvasRenderer,
    lineRenderer: LineRenderer,
    rectangleRenderer: RectangleRenderer,
    fixedTextRenderer: FixedTextRenderer,
    staticTextRenderer: StaticTextRenderer,
    staticImageRenderer: StaticImageRenderer,
    pathRenderer: PathRenderer,
  ) {
    super(clearCanvasRenderer, lineRenderer, rectangleRenderer, fixedTextRenderer, staticTextRenderer, staticImageRenderer, pathRenderer)
  }

  public MapBlockAsset(topLeft: Vector, width: number, height: number, color: string): MapBlockAsset {
    return this.assets.add(new MapBlockAsset(topLeft, width, height, color)
      .setTypeRenderer(this.rectangleRenderer)
      .setId(this.idGenerator.getNextId()))
  }
}
