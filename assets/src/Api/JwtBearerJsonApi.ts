import { JsonApi } from '@/Api/JsonApi'
import { AuthenticationException } from '@/Api/Jwt/AuthenticationException'
import type { RefreshTokenResponseParser } from '@/Api/Jwt/RefreshTokenResponseParser'
import type { TokenData } from '@/Api/Jwt/TokenData'
import { tokenStorage } from '@/Api/Jwt/TokenStorage'

export class JwtBearerJsonApi extends JsonApi {
  protected isRefreshingToken: boolean = false
  protected refreshTokenPromise: Promise<void> | null = null

  constructor(
    baseUrl: string,
    basePath: string,
    private refreshTokenEndpoint: string,
    private refreshTokenEndpointParamName: string,
    private refreshTokenEndpointParams: Record<string, string|number> = {},
    private refreshTokenResponseParser: RefreshTokenResponseParser,
  ) {
    super(baseUrl, basePath)
  }

  protected async preFetch(): Promise<void> {
    if (!this.isRefreshingToken && !tokenStorage.hasValidAccessToken(1)) {
      if (tokenStorage.hasRefreshToken() && tokenStorage.hasValidRefreshToken()) {
        this.isRefreshingToken = true
        this.refreshTokenEndpointParams[this.refreshTokenEndpointParamName] = tokenStorage.getRefreshToken()
        this.refreshTokenPromise = this.get(this.refreshTokenEndpoint, this.refreshTokenEndpointParams)
          .then(response => {
            return response.status === 200 ? response.json() : Promise.reject(response)
          })
          .then(data => {
            this.processNewTokenSet(data)
          })
          .catch(error => {
            throw new AuthenticationException(`${error.status} ${error.statusText}`)
          })
          .finally(() => {
            this.isRefreshingToken = false
            this.refreshTokenPromise = null
          })

        await this.refreshTokenPromise
      } else {
        throw new AuthenticationException(`Invalid access token and refresh token`)
      }
    }
  }

  protected processNewTokenSet(data: object): void {
    const tokenData: TokenData = this.refreshTokenResponseParser(data)

    tokenStorage.setAccessToken(tokenData.accessToken)
    tokenStorage.setRefreshToken(tokenData.refreshToken)
    tokenStorage.setRefreshTokenExp(tokenData.refreshTokenExpire)
  }

  protected getHeaders(map: Map<string, string>): void {
      super.getHeaders(map)

      if (tokenStorage.hasValidAccessToken(0)) {
      map.set('Authorization', `Bearer ${tokenStorage.getAccessToken()}`)
    }
  }
}
