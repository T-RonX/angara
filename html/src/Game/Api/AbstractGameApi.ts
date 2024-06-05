import { JwtBearerJsonApi } from '@/Api/JwtBearerJsonApi'
import type { TokenData } from '@/Api/Jwt/TokenData'
import { AuthenticationException } from '@/Api/Jwt/AuthenticationException'
import { tokenStorage } from '@/Api/Jwt/TokenStorage'

export abstract class AbstractGameApi extends JwtBearerJsonApi {
  private authenticatePromise: Promise<void> | null = null

  constructor(
      baseUrl: string,
      basePath: string,
      protected debug: boolean,
    ) {
    super(
      baseUrl,
      basePath,
      '/access/refresh-access-token',
      'refresh_token',
      { XDEBUG_SESSION_START: debug ? 1 : 0 },
      (data: any): TokenData => {
        return {
          accessToken: data.token,
          refreshToken: data.refresh_token,
          refreshTokenExpire: data.refresh_token_expiration,
        }
      },
    )
  }

  protected async preFetch(): Promise<void> {
    await this.authenticatePromise
    const result: Promise<void> = super.preFetch()
    await result

    if (!this.isRefreshingToken && this.authenticatePromise === null && !tokenStorage.hasValidAccessToken(1)) {
      throw new AuthenticationException('No access token')
    }

    return result
  }

  protected async doGet(path: string, params: Record<string, string|number> = {}): Promise<any> {

    return this.get(path, params).then(r => r.json())
  }

  protected buildQueryString(path: string, params: Record<string, string|number> = {}): string {
    if (this.debug) {
      params.XDEBUG_SESSION_START = 1
    }

    return super.buildQueryString(path, params)
  }

  public async authenticate(username: string, password: string): Promise<void> {
    this.isRefreshingToken = true
    tokenStorage.clear()
    this.authenticatePromise = this.post('/access/authenticate', {
      username: username,
      password: password,
    }, { XDEBUG_SESSION_START: this.debug ? 1 : 0 })
      .then(response => response.status === 200 ? response.json() : Promise.reject(response))
      .then((data) => {
        this.processNewTokenSet(data)
      })
      .catch(error => {
        throw new AuthenticationException(`${error.status} ${error.statusText}`)
      })
      .finally(() => {
        this.authenticatePromise = null
      })

    await this.authenticatePromise
    this.isRefreshingToken = false
  }

  public setDebug(debug: boolean): void {
    this.debug = debug
  }
}
