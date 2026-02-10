export interface AvaPhoenixEnvelope {
  event_id: string
  schema_version: number
  event_type: string
  workspace_id: string
  occurred_at: string
  payload: Record<string, unknown>
}

export interface PhoenixChannelClientConfig {
  url: string
  topic: string
  authToken?: string
  resolveAuthToken?: () => Promise<string>
  params?: Record<string, unknown>
  timeoutMs?: number
}

export interface PhoenixPushLike {
  receive(status: 'ok' | 'error' | 'timeout', callback: (payload: any) => void): PhoenixPushLike
}

export interface PhoenixChannelLike {
  join(timeout?: number): PhoenixPushLike
  leave(timeout?: number): PhoenixPushLike
  on(event: string, callback: (payload: any) => void): void
  push(event: string, payload: any, timeout?: number): PhoenixPushLike
}

export interface PhoenixSocketLike {
  connect(): void
  disconnect(code?: number, reason?: string): void
  channel(topic: string, params?: Record<string, unknown>): PhoenixChannelLike
}

export interface PhoenixChannelClientDependencies {
  createSocket?: (url: string, options: { authToken: string }) => PhoenixSocketLike
}

export class PhoenixChannelClient {
  private readonly config: PhoenixChannelClientConfig
  private readonly createSocket?: (url: string, options: { authToken: string }) => PhoenixSocketLike
  private socket: PhoenixSocketLike | null = null
  private channel: PhoenixChannelLike | null = null

  constructor(config: PhoenixChannelClientConfig, deps: PhoenixChannelClientDependencies = {}) {
    this.config = config
    this.createSocket = deps.createSocket
  }

  async connect(): Promise<void> {
    if (this.channel) return

    const authToken = await this.resolveAuthToken()
    const socket = await this.resolveSocket(this.config.url, { authToken })
    socket.connect()

    const channel = socket.channel(this.config.topic, this.config.params ?? {})
    await this.awaitPush(channel.join(this.config.timeoutMs), 'join')

    this.socket = socket
    this.channel = channel
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.awaitPush(this.channel.leave(this.config.timeoutMs), 'leave')
    }

    if (this.socket) {
      this.socket.disconnect(1000, 'normal')
    }

    this.channel = null
    this.socket = null
  }

  onEvent(handler: (event: AvaPhoenixEnvelope) => void): void {
    if (!this.channel) {
      throw new Error('Phoenix channel is not connected')
    }

    this.channel.on('ava_event', (payload: AvaPhoenixEnvelope) => {
      handler(payload)
    })
  }

  async publish(event: AvaPhoenixEnvelope): Promise<void> {
    if (!this.channel) {
      throw new Error('Phoenix channel is not connected')
    }

    await this.awaitPush(
      this.channel.push('publish', { event }, this.config.timeoutMs),
      'publish',
    )
  }

  async ping(payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.channel) {
      throw new Error('Phoenix channel is not connected')
    }

    await this.awaitPush(this.channel.push('ping', payload, this.config.timeoutMs), 'ping')
  }

  private async resolveAuthToken(): Promise<string> {
    if (this.config.authToken) {
      return this.config.authToken
    }

    if (this.config.resolveAuthToken) {
      return this.config.resolveAuthToken()
    }

    throw new Error('Phoenix channel auth token is missing')
  }

  private async resolveSocket(
    url: string,
    options: { authToken: string },
  ): Promise<PhoenixSocketLike> {
    if (this.createSocket) {
      return this.createSocket(url, options)
    }

    const phoenixSpecifier = 'phoenix'
    const phoenixModule = (await import(/* @vite-ignore */ phoenixSpecifier)) as {
      Socket: new (url: string, options: { authToken: string }) => PhoenixSocketLike
    }

    return new phoenixModule.Socket(url, options)
  }

  private awaitPush(push: PhoenixPushLike, operation: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false

      push
        .receive('ok', () => {
          settled = true
          resolve()
        })
        .receive('error', (payload) => {
          settled = true
          reject(new Error(`phoenix ${operation} error: ${JSON.stringify(payload)}`))
        })
        .receive('timeout', () => {
          settled = true
          reject(new Error(`phoenix ${operation} timeout`))
        })

      setTimeout(() => {
        if (!settled) {
          reject(new Error(`phoenix ${operation} unresolved`))
        }
      }, this.config.timeoutMs ?? 5000)
    })
  }
}
