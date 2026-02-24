/**
 * MqttTransport tests — verifies the Effect-native MQTT service layer.
 *
 * Uses vi.mock to intercept mqtt.connect and SparkplugCodec.encodePayload
 * so no real broker is required.
 */

import { vi, expect } from 'vitest'
import { it, describe } from '@effect/vitest'
import { Effect, Layer, Scope } from 'effect'
import { EventEmitter } from 'events'
import type { SparkplugConfig } from '../src/config'

// =============================================================================
// Mocks — must be before any import that touches the mocked modules
// =============================================================================

/** Shared mock client instance — reset per test via beforeEach */
let mockClient: ReturnType<typeof createMockClient>

function createMockClient() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    publish: vi.fn(
      (
        _topic: string,
        _payload: Buffer,
        _opts: unknown,
        cb: (err?: Error | null) => void,
      ) => {
        cb(null)
      },
    ),
    subscribe: vi.fn(
      (
        _topic: string,
        _opts: unknown,
        cb: (err?: Error | null) => void,
      ) => {
        cb(null)
      },
    ),
    end: vi.fn(),
    removeListener: vi.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        emitter.removeListener(event, handler)
      },
    ),
  })
}

vi.mock('mqtt', () => ({
  connect: vi.fn((_url: string, _opts: unknown) => {
    mockClient = createMockClient()
    // Auto-emit 'connect' on next tick so the Effect.async resumes
    setTimeout(() => mockClient.emit('connect'), 0)
    return mockClient
  }),
}))

vi.mock('../src/SparkplugCodec', () => ({
  encodePayload: vi.fn((_payload: unknown) =>
    new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  ),
}))

// Import after mocks are registered
const { MqttTransport, MqttTransportLive } = await import(
  '../src/MqttTransport'
)
const mqtt = await import('mqtt')
const SparkplugCodecModule = await import('../src/SparkplugCodec')

// =============================================================================
// Test config
// =============================================================================

const testConfig: SparkplugConfig = {
  _tag: 'SparkplugConfig',
  serverUrl: 'mqtt://test:1883',
  groupId: 'test-group',
  edgeNodeId: 'test-edge',
  mqtt: { cleanSession: true, keepalive: 65, reconnectPeriod: 1000, connectTimeout: 30000 },
  will: { qos: 1, retain: false },
  publish: { qos: 0, retain: false },
  state: { enabled: false, qos: 1, retain: true },
}

// =============================================================================
// Helper: build a managed transport for test use
// =============================================================================

const runWithTransport = <A, E>(
  f: (svc: Effect.Effect.Success<ReturnType<typeof MqttTransport['of']>> extends never
    ? never
    : ReturnType<typeof MqttTransport['of']> extends infer T ? T : never
  ) => Effect.Effect<A, E>,
  config: SparkplugConfig = testConfig,
  bdSeq = 0,
) => {
  const layer = MqttTransportLive(config, bdSeq)
  return Effect.gen(function* () {
    const svc = yield* MqttTransport
    return yield* f(svc)
  }).pipe(Effect.provide(layer), Effect.scoped)
}

// =============================================================================
// Tests
// =============================================================================

describe('MqttTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // Layer construction — Will message
  // ===========================================================================

  describe('Will message construction', () => {
    it.effect('passes NDEATH Will topic derived from config', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        const opts = connectCall![1] as { will: { topic: string } }

        expect(opts.will.topic).toBe('spBv1.0/test-group/NDEATH/test-edge')
      })),
    )

    it.effect('sets Will QoS from config.will.qos', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        const opts = connectCall![1] as { will: { qos: number } }

        expect(opts.will.qos).toBe(1)
      })),
    )

    it.effect('sets Will retain from config.will.retain', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        const opts = connectCall![1] as { will: { retain: boolean } }

        expect(opts.will.retain).toBe(false)
      })),
    )

    it.effect('encodes Will payload as Buffer', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        const opts = connectCall![1] as { will: { payload: Buffer } }

        expect(Buffer.isBuffer(opts.will.payload)).toBe(true)
      })),
    )

    it.effect('passes bdSeq to Will payload construction', () =>
      runWithTransport(
        () => Effect.gen(function* () {
          const encodePayload = SparkplugCodecModule.encodePayload as unknown as ReturnType<typeof vi.fn>
          const encodeCall = encodePayload.mock.calls[0]
          const payload = encodeCall![0] as { metrics: Array<{ name: string; value: number }> }

          expect(payload.metrics[0]!.name).toBe('bdSeq')
          expect(payload.metrics[0]!.value).toBe(7)
        }),
        testConfig,
        7,
      ),
    )
  })

  // ===========================================================================
  // MQTT connect options
  // ===========================================================================

  describe('MQTT connect options', () => {
    it.effect('passes serverUrl to mqtt.connect', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(connectCall![0]).toBe('mqtt://test:1883')
      })),
    )

    it.effect('derives mqtt options from config', () =>
      runWithTransport(() => Effect.gen(function* () {
        const connectCall = (mqtt.connect as ReturnType<typeof vi.fn>).mock.calls[0]
        const opts = connectCall![1] as Record<string, unknown>

        expect(opts.clean).toBe(true)
        expect(opts.keepalive).toBe(65)
        expect(opts.reconnectPeriod).toBe(1000)
        expect(opts.connectTimeout).toBe(30000)
      })),
    )
  })

  // ===========================================================================
  // publish
  // ===========================================================================

  describe('publish', () => {
    it.effect('calls client.publish with correct arguments', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        const payload = Buffer.from('hello')
        yield* svc.publish('test/topic', payload, { qos: 1, retain: true })

        expect(mockClient.publish).toHaveBeenCalledOnce()
        const call = mockClient.publish.mock.calls[0]!
        expect(call[0]).toBe('test/topic')
        expect(Buffer.isBuffer(call[1])).toBe(true)
        expect(call[2]).toEqual({ qos: 1, retain: true })
      })),
    )

    it.effect('defaults to qos 0 and retain false', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        yield* svc.publish('test/topic', Buffer.from('data'))

        const call = mockClient.publish.mock.calls[0]!
        expect(call[2]).toEqual({ qos: 0, retain: false })
      })),
    )

    it.effect('maps publish error to SparkplugError TRANSPORT_ERROR', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        mockClient.publish.mockImplementationOnce(
          (
            _topic: string,
            _payload: Buffer,
            _opts: unknown,
            cb: (err?: Error | null) => void,
          ) => {
            cb(new Error('publish failed'))
          },
        )

        const result = yield* svc
          .publish('test/topic', Buffer.from('data'))
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SparkplugError')
          expect(result.left.code).toBe('TRANSPORT_ERROR')
          expect(result.left.retryable).toBe(true)
          expect(result.left.message).toContain('publish failed')
        }
      })),
    )
  })

  // ===========================================================================
  // subscribe
  // ===========================================================================

  describe('subscribe', () => {
    it.effect('calls client.subscribe with correct arguments', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        yield* svc.subscribe('spBv1.0/test-group/NCMD/test-edge', 1)

        expect(mockClient.subscribe).toHaveBeenCalledOnce()
        const call = mockClient.subscribe.mock.calls[0]!
        expect(call[0]).toBe('spBv1.0/test-group/NCMD/test-edge')
        expect(call[1]).toEqual({ qos: 1 })
      })),
    )

    it.effect('defaults to qos 0', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        yield* svc.subscribe('test/topic')

        const call = mockClient.subscribe.mock.calls[0]!
        expect(call[1]).toEqual({ qos: 0 })
      })),
    )

    it.effect('maps subscribe error to SparkplugError TRANSPORT_ERROR', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        mockClient.subscribe.mockImplementationOnce(
          (
            _topic: string,
            _opts: unknown,
            cb: (err?: Error | null) => void,
          ) => {
            cb(new Error('subscribe failed'))
          },
        )

        const result = yield* svc
          .subscribe('test/topic')
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SparkplugError')
          expect(result.left.code).toBe('TRANSPORT_ERROR')
          expect(result.left.retryable).toBe(true)
          expect(result.left.message).toContain('subscribe failed')
        }
      })),
    )
  })

  // ===========================================================================
  // isConnected
  // ===========================================================================

  describe('isConnected', () => {
    it.effect('returns true after successful connect', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        const connected = yield* svc.isConnected
        expect(connected).toBe(true)
      })),
    )
  })

  // ===========================================================================
  // Connection error
  // ===========================================================================

  describe('connection error', () => {
    it.effect('maps mqtt error event to SparkplugError CONNECTION_FAILED', () =>
      Effect.gen(function* () {
        // Override the mqtt.connect mock to emit 'error' instead of 'connect'
        ;(mqtt.connect as ReturnType<typeof vi.fn>).mockImplementationOnce(
          (_url: string, _opts: unknown) => {
            mockClient = createMockClient()
            setTimeout(() => mockClient.emit('error', new Error('connection refused')), 0)
            return mockClient
          },
        )

        const layer = MqttTransportLive(testConfig)
        const result = yield* Effect.gen(function* () {
          const svc = yield* MqttTransport
          return yield* svc.isConnected
        }).pipe(Effect.provide(layer), Effect.scoped, Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SparkplugError')
          expect(result.left.code).toBe('CONNECTION_FAILED')
          expect(result.left.retryable).toBe(true)
          expect(result.left.message).toContain('connection refused')
        }
      }),
    )
  })

  // ===========================================================================
  // client exposed
  // ===========================================================================

  describe('client', () => {
    it.effect('exposes the underlying mqtt client', () =>
      runWithTransport((svc) => Effect.gen(function* () {
        expect(svc.client).toBeDefined()
        expect(typeof svc.client.publish).toBe('function')
        expect(typeof svc.client.subscribe).toBe('function')
      })),
    )
  })
})
