import type { MonitorInterface } from '@/Renderer/Monitor/MonitorInterface'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import { IdGenerator } from '@/Renderer/RenderStack/IdGenerator'

export class RenderStack {
  private renderers: Array<SpriteGeneratorInterface> = []
  private monitors: Array<MonitorInterface> = []
  private idGenerator: IdGenerator = new IdGenerator()

  public addSpriteGenerator(sprite: SpriteGeneratorInterface): void {
    this.renderers.push(sprite)
  }

  public getSpriteGenerators(): SpriteGeneratorInterface[] {
    return this.renderers
  }

  public addMonitor(monitor: MonitorInterface): void {
    this.monitors.push(monitor)
  }

  public getMonitors(): MonitorInterface[] {
    return this.monitors
  }

  public reset() {
    for (let i: number = 0; i < this.renderers.length; ++i) {
      this.renderers[i].reset();
    }
  }
}
