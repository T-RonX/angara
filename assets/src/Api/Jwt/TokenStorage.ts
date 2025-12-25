export class TokenStorage {
  private accessToken: string|null = null
  private accessTokenExp: number = 0
  private refreshToken: string|null = null
  private refreshTokenExp: number = 0

  public setAccessToken(token: string|null): void {
    this.accessToken = token

    if (this.accessToken !== null) {
      this.accessTokenExp = this.parseExpFromJwt(this.accessToken)
    }
  }

  public getAccessToken(): string {
    if (this.accessToken === null) {
      throw new Error('Can not get access token from storage, the token was not set.')
    }

    return this.accessToken
  }

  public hasAccessToken(): boolean {
    return this.accessToken !== null
  }

  public hasValidAccessToken(margin: number = 60): boolean {
    return this.hasAccessToken() && this.getAccessTokenExp() - margin > this.getNow()
  }

  public getAccessTokenExp(): number {
    return this.accessTokenExp
  }

  public setRefreshToken(token: string|null): void {
    this.refreshToken = token
  }

  public getRefreshToken(): string {
    if (this.refreshToken === null) {
      throw new Error('Can not get refresh token from storage, the token was not set.')
    }

    return this.refreshToken
  }

  public hasRefreshToken(): boolean {
    return this.refreshToken !== null
  }

  public hasValidRefreshToken(): boolean {
    return this.hasRefreshToken() && this.getRefreshTokenExp() > this.getNow()
  }

  public setRefreshTokenExp(exp: number): void {
    this.refreshTokenExp = exp
  }

  public getRefreshTokenExp(): number {
    return this.refreshTokenExp
  }

  public clear(): void {
    this.accessToken = ''
    this.accessTokenExp = 0
    this.refreshToken = ''
    this.refreshTokenExp = 0
  }

  protected parseExpFromJwt(jwt: string|null): number {
    if (jwt !== null) {
      const [, bodyRaw,] = jwt.split('.')
      const body: { exp: string } = JSON.parse(atob(bodyRaw))

      if (typeof body === 'object' && 'exp' in body) {
        return parseInt(body.exp)
      }
    }

    return 0
  }

  public getNow(): number {
    return Math.floor(Date.now() / 1000)
  }
}

export const tokenStorage: TokenStorage = new TokenStorage()
