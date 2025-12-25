import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator';
export class FpsSprite extends AbstractSpriteGenerator {
    monitor;
    constructor(monitor, spriteType) {
        super(spriteType);
        this.monitor = monitor;
    }
    getSprites(renderContext) {
        return [
        /*this.getFactory().createFixedText(
          String(Math.trunc(this.monitor.getFps())) + ' fps',
          new Vector( renderContext.getCanvas().clientWidth - 90, 26),
          '24px arial',
          'red'
        )*/
        ];
    }
}
