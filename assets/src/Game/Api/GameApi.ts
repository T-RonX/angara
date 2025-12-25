import { AbstractGameApi } from '@/Game/Api/AbstractGameApi'
import type { InitData } from '@/Game/Api/Data/InitData'

export class GameApi extends AbstractGameApi {
  public async getInitData(): Promise<InitData> {
    return this.doGet('/test')
  }
}
