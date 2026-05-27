import { AbstractSpriteGenerator } from '@/Renderer/Sprite/AbstractSpriteGenerator';
export class FpsSprite extends AbstractSpriteGenerator {
    constructor(monitor, spriteType) {
        super(spriteType);
        Object.defineProperty(this, "monitor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: monitor
        });
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
//# sourceMappingURL=FpsSprite.js.map