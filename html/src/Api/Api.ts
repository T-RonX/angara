export class Api {
  constructor(
    protected baseUrl: string,
    protected basePath: string = '',
  ) {
  }

  public async post(path: string, data: any, params: Record<string, string|number> = {}): Promise<Response> {
    return this.fetch('POST', this.buildQueryString(path, params), data)
  }

  public async get(path: string, params: Record<string, string|number> = {}): Promise<Response> {
    return this.fetch('GET', this.buildQueryString(path, params))
  }

  protected async fetch(method: string, path: string, data: any = null): Promise<Response> {
    await this.preFetch()
    const promise: Promise<Response> = fetch(this.createRequestInfo(path), this.createOptions(method, data))
    this.postFetch()

    return promise
  }

  protected buildQueryString(path: string, params: Record<string, string|number> = {}): string {
    if (params) {
      path += "?" + Object.entries(params).map(([key, value]): string => `${key}=${encodeURIComponent(value)}`).join("&")
    }

    return path;
  }

  protected async preFetch(): Promise<void> {
  }

  protected postFetch(): void {
  }

  protected createRequestInfo(path: string): RequestInfo {
    return `${this.baseUrl}${this.basePath}${path}`
  }

  protected createOptions(method: string, data: any = null): RequestInit {
    const options: RequestInit = {
      method: method,
      headers: this.createHeaders(),
    }

    if (data !== null) {
      options.body = this.prepareData(data)
    }

    return options
  }

  protected prepareData(data: any): string|null {
    return data
  }

  protected createHeaders(): HeadersInit {
    const map: Map<string, string> = new Map()
    this.getHeaders(map)

    return Object.fromEntries(map.entries())
  }

  protected getHeaders(map: Map<string, string>): void {
  }
}
