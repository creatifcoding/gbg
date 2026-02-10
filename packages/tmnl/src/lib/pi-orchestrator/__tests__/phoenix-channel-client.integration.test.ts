import { describe, expect, it } from 'vitest'

import {
  PhoenixChannelClient,
  type AvaPhoenixEnvelope,
  type PhoenixChannelLike,
  type PhoenixPushLike,
  type PhoenixSocketLike,
} from '../client/PhoenixChannelClient'

class FakePush implements PhoenixPushLike {
  constructor(
    private readonly result: 'ok' | 'error' | 'timeout',
    private readonly payload: unknown,
  ) {}

  receive(status: 'ok' | 'error' | 'timeout', callback: (payload: any) => void): PhoenixPushLike {
    if (status === this.result) {
      callback(this.payload)
    }

    return this
  }
}

class FakeChannel implements PhoenixChannelLike {
  public readonly published: Array<{ event: string; payload: unknown }> = []
  private readonly handlers = new Map<string, Array<(payload: any) => void>>()

  join(): PhoenixPushLike {
    return new FakePush('ok', { joined: true })
  }

  leave(): PhoenixPushLike {
    return new FakePush('ok', { left: true })
  }

  on(event: string, callback: (payload: any) => void): void {
    const handlers = this.handlers.get(event) ?? []
    handlers.push(callback)
    this.handlers.set(event, handlers)
  }

  push(event: string, payload: any): PhoenixPushLike {
    this.published.push({ event, payload })
    return new FakePush('ok', { accepted: true })
  }

  emit(event: string, payload: unknown): void {
    const handlers = this.handlers.get(event) ?? []
    handlers.forEach((handler) => handler(payload))
  }
}

class FakeSocket implements PhoenixSocketLike {
  public connected = false
  public disconnected = false
  public readonly channelInstance = new FakeChannel()

  connect(): void {
    this.connected = true
  }

  disconnect(): void {
    this.disconnected = true
  }

  channel(): PhoenixChannelLike {
    return this.channelInstance
  }
}

describe('PhoenixChannelClient', () => {
  it('connects and receives ava_event payloads', async () => {
    const fakeSocket = new FakeSocket()

    const client = new PhoenixChannelClient(
      {
        url: 'ws://localhost:4010/socket',
        topic: 'ava:workspace:ws-1:events',
        authToken: 'token',
      },
      {
        createSocket: () => fakeSocket,
      },
    )

    await client.connect()

    let received: AvaPhoenixEnvelope | null = null
    client.onEvent((event) => {
      received = event
    })

    const envelope: AvaPhoenixEnvelope = {
      event_id: 'evt-1',
      schema_version: 1,
      event_type: 'ava.artifact.updated',
      workspace_id: 'ws-1',
      occurred_at: new Date().toISOString(),
      payload: { artifact_id: 'a1' },
    }

    fakeSocket.channelInstance.emit('ava_event', envelope)

    expect(received).not.toBeNull()
    expect(received?.event_type).toBe('ava.artifact.updated')
    expect(fakeSocket.connected).toBe(true)
  })

  it('publishes envelope payloads through channel push', async () => {
    const fakeSocket = new FakeSocket()

    const client = new PhoenixChannelClient(
      {
        url: 'ws://localhost:4010/socket',
        topic: 'ava:workspace:ws-2:events',
        authToken: 'token',
      },
      {
        createSocket: () => fakeSocket,
      },
    )

    await client.connect()

    const envelope: AvaPhoenixEnvelope = {
      event_id: 'evt-2',
      schema_version: 1,
      event_type: 'ava.artifact.created',
      workspace_id: 'ws-2',
      occurred_at: new Date().toISOString(),
      payload: { artifact_id: 'a2' },
    }

    await client.publish(envelope)

    expect(fakeSocket.channelInstance.published).toHaveLength(1)
    expect(fakeSocket.channelInstance.published[0]).toEqual({
      event: 'publish',
      payload: { event: envelope },
    })
  })

  it('disconnects cleanly', async () => {
    const fakeSocket = new FakeSocket()

    const client = new PhoenixChannelClient(
      {
        url: 'ws://localhost:4010/socket',
        topic: 'ava:workspace:ws-3:events',
        authToken: 'token',
      },
      {
        createSocket: () => fakeSocket,
      },
    )

    await client.connect()
    await client.disconnect()

    expect(fakeSocket.disconnected).toBe(true)
  })

  it('supports async auth token resolution', async () => {
    const fakeSocket = new FakeSocket()
    const resolvedTokens: string[] = []

    const client = new PhoenixChannelClient(
      {
        url: 'ws://localhost:4010/socket',
        topic: 'ava:workspace:ws-4:events',
        resolveAuthToken: async () => {
          resolvedTokens.push('token-resolved')
          return 'token-resolved'
        },
      },
      {
        createSocket: () => fakeSocket,
      },
    )

    await client.connect()

    expect(resolvedTokens).toEqual(['token-resolved'])
  })
})
