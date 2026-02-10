export interface PhoenixChannelTokenPayload {
  token: string
  expiresAtMs: number
}

export interface PhoenixChannelTokenManagerOptions {
  refreshSkewMs?: number
  now?: () => number
}

export class PhoenixChannelTokenManager {
  private readonly refreshSkewMs: number
  private readonly now: () => number
  private cache: PhoenixChannelTokenPayload | null = null

  constructor(
    private readonly fetchToken: () => Promise<PhoenixChannelTokenPayload>,
    options: PhoenixChannelTokenManagerOptions = {},
  ) {
    this.refreshSkewMs = options.refreshSkewMs ?? 30_000
    this.now = options.now ?? (() => Date.now())
  }

  async getToken(): Promise<string> {
    if (this.cache && this.cache.expiresAtMs - this.now() > this.refreshSkewMs) {
      return this.cache.token
    }

    const next = await this.fetchToken()
    this.cache = next
    return next.token
  }

  clear(): void {
    this.cache = null
  }
}
