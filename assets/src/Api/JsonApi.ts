import { Api } from '@/Api/Api'

export class JsonApi extends Api {
  constructor(
    baseUrl: string,
    basePath: string = '',
  ) {
    super(baseUrl, basePath)
  }
  protected getHeaders(map: Map<string, string>): void {
    super.getHeaders(map)
    map.set('Content-Type', 'application/json')
  }

  protected prepareData(data: any): string|null {
    return JSON.stringify(super.prepareData(data))
  }
}
