import type { FpsMonitorInterface } from '@/Renderer/Monitor/Fps/FpsMonitorInterface'
import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { SpriteType } from '@/Renderer/Sprite/SpriteType'

export class FpsSprite extends AbstractSpriteGenerator implements SpriteGeneratorInterface {
  public constructor(
    private monitor: FpsMonitorInterface,
    spriteType: SpriteType
  ) {
    super(spriteType)
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    return [
      /*this.getFactory().createFixedText(
        String(Math.trunc(this.monitor.getFps())) + ' fps',
        new Vector( renderContext.getCanvas().clientWidth - 90, 26),
        '24px arial',
        'red'
      )*/
    ]
  }
}
