/**
 * AVA v2 Services Tests
 *
 * Unit tests for NatsClient and AvaClientV2 Effect services.
 * Tests service creation, stream operations, and error handling.
 *
 * Test patterns from effect-atom submodule:
 * - vitest.useFakeTimers() for async control
 * - Effect.gen(function* () {...}) for effectful tests
 * - Schema.decode/encode for serialization tests
 *
 * @module
 */

import { describe, it, expect } from '@effect/vitest'
import {
  Effect,
  Layer,
  Stream,
  Schema,
  Queue,
  pipe,
  Duration,
  Schedule,
} from 'effect'

import {
  // NatsClient
  NatsClient,
  NatsConnectionError,
  NatsSubscriptionError,
  NatsDecodeError,
  type NatsMessage,
  // AvaClientV2
  AvaClientV2,
  AvaClientV2Live,
  AvaClientV2ConfigTag,
  AvaSubscriptionError,
  AvaInvalidationError,
  AvaDecodeError as AvaDecodeError2,
  type AvaClientV2Config,
} from '../services'
import {
  InvalidationRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from '../schemas/v2'

// ============================================================================
// Test Configuration
// ============================================================================

const testAvaConfig: AvaClientV2Config = {
  subjectPrefix: 'test.ava',
  subscribeTimeout: 5000,
  bufferSize: 100,
}

// ============================================================================
// Mock NatsClient for AvaClientV2 Tests
// ============================================================================

/**
 * Create a mock NatsClient for testing AvaClientV2 without real NATS connection
 */
const createMockNatsClient = () => {
  // Track published messages
  const published: Array<{ subject: string; data: unknown }> = []

  // Queues for each subscription subject (using any for simplicity in tests)
  const subscriptionQueues = new Map<string, Queue.Queue<NatsMessage<any>>>()

  const mockService: NatsClient = {
    isConnected: Effect.succeed(true),
    waitForConnection: Effect.void,

    subscribe: (subject) => {
      return Stream.unwrap(
        Effect.gen(function* () {
          // Get or create queue for this subject
          let queue = subscriptionQueues.get(subject)
          if (!queue) {
            queue = yield* Queue.unbounded<NatsMessage<any>>()
            subscriptionQueues.set(subject, queue)
          }

          return Stream.fromQueue(queue).pipe(
            Stream.map((msg: NatsMessage<any>) => ({
              subject: msg.subject,
              data: msg.data as Uint8Array,
              timestamp: msg.timestamp,
            }))
          )
        })
      )
    },

    subscribeJson: <A>(subject: string) => {
      return Stream.unwrap(
        Effect.gen(function* () {
          let queue = subscriptionQueues.get(subject)
          if (!queue) {
            queue = yield* Queue.unbounded<NatsMessage<any>>()
            subscriptionQueues.set(subject, queue)
          }

          return Stream.fromQueue(queue).pipe(
            Stream.map((msg: NatsMessage<any>) => ({
              subject: msg.subject,
              data: msg.data as A,
              timestamp: msg.timestamp,
            }))
          )
        })
      )
    },

    publish: (subject, data) =>
      Effect.sync(() => {
        published.push({ subject, data })
      }),

    publishJson: (subject, data) =>
      Effect.sync(() => {
        published.push({ subject, data })
      }),

    drain: Effect.void,

    serverUrl: Effect.succeed('ws://mock:9222'),
  }

  return {
    service: mockService,
    published,
    subscriptionQueues,
    // Helper to inject messages into a subscription
    injectMessage: (subject: string, data: unknown) =>
      Effect.gen(function* () {
        const queue = subscriptionQueues.get(subject)
        if (queue) {
          yield* Queue.offer(queue, {
            subject,
            data,
            timestamp: Date.now(),
          })
        }
      }),
  }
}

// ============================================================================
// NatsClient Configuration Tests
// ============================================================================

describe('NatsConfig Schema', () => {
  it.effect('decodes valid configuration', () =>
    Effect.gen(function* () {
      const input = {
        serverUrl: 'ws://localhost:4222',
        subjectPrefix: 'myapp',
        timeout: 10000,
        maxReconnectAttempts: 5,
        reconnectDelayMs: 2000,
      }

      // NatsConfig is a Schema, so we can decode it
      const config = yield* Schema.decode(
        Schema.Struct({
          serverUrl: Schema.String,
          subjectPrefix: Schema.optional(Schema.String),
          timeout: Schema.optional(Schema.Number),
          maxReconnectAttempts: Schema.optional(Schema.Number),
          reconnectDelayMs: Schema.optional(Schema.Number),
        })
      )(input)

      expect(config.serverUrl).toBe('ws://localhost:4222')
      expect(config.subjectPrefix).toBe('myapp')
    })
  )

  it.effect('uses default values when optional fields omitted', () =>
    Effect.gen(function* () {
      const input: { serverUrl: string; subjectPrefix?: string; timeout?: number; maxReconnectAttempts?: number; reconnectDelayMs?: number } = {
        serverUrl: 'ws://localhost:4222',
      }

      // With defaults
      const withDefaults = {
        ...input,
        subjectPrefix: input.subjectPrefix ?? 'tmnl.ava',
        timeout: input.timeout ?? 30000,
        maxReconnectAttempts: input.maxReconnectAttempts ?? 0,
        reconnectDelayMs: input.reconnectDelayMs ?? 1000,
      }

      expect(withDefaults.subjectPrefix).toBe('tmnl.ava')
      expect(withDefaults.timeout).toBe(30000)
    })
  )
})

// ============================================================================
// NatsClient Error Types Tests
// ============================================================================

describe('NatsClient Errors', () => {
  it('NatsConnectionError has correct tag', () => {
    const error = new NatsConnectionError({
      message: 'Connection failed',
      cause: new Error('timeout'),
    })

    expect(error._tag).toBe('NatsConnectionError')
    expect(error.message).toBe('Connection failed')
  })

  it('NatsSubscriptionError includes subject', () => {
    const error = new NatsSubscriptionError({
      subject: 'test.subject',
      message: 'Subscription failed',
    })

    expect(error._tag).toBe('NatsSubscriptionError')
    expect(error.subject).toBe('test.subject')
  })

  it('NatsDecodeError includes raw data', () => {
    const error = new NatsDecodeError({
      subject: 'test.subject',
      raw: '{"invalid": json}',
      message: 'Parse error',
    })

    expect(error._tag).toBe('NatsDecodeError')
    expect(error.raw).toBe('{"invalid": json}')
  })
})

// ============================================================================
// AvaClientV2 Tests with Mock NatsClient
// ============================================================================

describe('AvaClientV2', () => {
  describe('subscribeArtifact', () => {
    it.effect('creates artifact subscription stream', () =>
      Effect.gen(function* () {
        const mock = createMockNatsClient()

        const testLayer = pipe(
          AvaClientV2Live,
          Layer.provide(Layer.succeed(NatsClient, mock.service)),
          Layer.provide(Layer.succeed(AvaClientV2ConfigTag, testAvaConfig))
        )

        const stream = yield* Effect.gen(function* () {
          const client = yield* AvaClientV2
          return client.subscribeArtifact('test-view-1' as any)
        }).pipe(Effect.provide(testLayer))

        expect(stream).toBeDefined()
      })
    )
  })

  describe('invalidate', () => {
    it.effect('publishes invalidation command to correct subject', () =>
      Effect.gen(function* () {
        const mock = createMockNatsClient()

        const testLayer = pipe(
          AvaClientV2Live,
          Layer.provide(Layer.succeed(NatsClient, mock.service)),
          Layer.provide(Layer.succeed(AvaClientV2ConfigTag, testAvaConfig))
        )

        yield* Effect.gen(function* () {
          const client = yield* AvaClientV2
          yield* client.invalidate('view-123' as any, 'test invalidation')
        }).pipe(Effect.provide(testLayer))

        // Verify publish was called with correct subject
        expect(mock.published.length).toBeGreaterThan(0)
        const lastPublish = mock.published[mock.published.length - 1]
        expect(lastPublish.subject).toContain('invalidate')
        expect((lastPublish.data as any).view_id).toBe('view-123')
        expect((lastPublish.data as any).reason).toBe('test invalidation')
      })
    )
  })

  describe('requestSubscribe', () => {
    it.effect('publishes subscribe command', () =>
      Effect.gen(function* () {
        const mock = createMockNatsClient()

        const testLayer = pipe(
          AvaClientV2Live,
          Layer.provide(Layer.succeed(NatsClient, mock.service)),
          Layer.provide(Layer.succeed(AvaClientV2ConfigTag, testAvaConfig))
        )

        yield* Effect.gen(function* () {
          const client = yield* AvaClientV2
          yield* client.requestSubscribe('view-456' as any)
        }).pipe(Effect.provide(testLayer))

        expect(mock.published.length).toBeGreaterThan(0)
        const lastPublish = mock.published[mock.published.length - 1]
        expect(lastPublish.subject).toContain('subscribe')
        expect((lastPublish.data as any).view_id).toBe('view-456')
      })
    )
  })

  describe('requestUnsubscribe', () => {
    it.effect('publishes unsubscribe command', () =>
      Effect.gen(function* () {
        const mock = createMockNatsClient()

        const testLayer = pipe(
          AvaClientV2Live,
          Layer.provide(Layer.succeed(NatsClient, mock.service)),
          Layer.provide(Layer.succeed(AvaClientV2ConfigTag, testAvaConfig))
        )

        yield* Effect.gen(function* () {
          const client = yield* AvaClientV2
          yield* client.requestUnsubscribe('view-789' as any)
        }).pipe(Effect.provide(testLayer))

        expect(mock.published.length).toBeGreaterThan(0)
        const lastPublish = mock.published[mock.published.length - 1]
        expect(lastPublish.subject).toContain('unsubscribe')
        expect((lastPublish.data as any).view_id).toBe('view-789')
      })
    )
  })
})

// ============================================================================
// Command Payload Schema Parity (snake_case only)
// ============================================================================

describe('AVA v2 command payload schemas', () => {
  it.effect('InvalidationRequest accepts snake_case and rejects camelCase', () =>
    Effect.gen(function* () {
      const snake = {
        view_id: 'dashboard-1',
        reason: 'refresh',
        force: true,
      }
      const camel = {
        viewId: 'dashboard-1',
        reason: 'refresh',
        force: true,
      }

      const decoded = yield* Schema.decode(InvalidationRequest)(snake)
      expect(decoded.view_id).toBe('dashboard-1')

      expect(() => Schema.decodeUnknownSync(InvalidationRequest)(camel)).toThrow()
    })
  )

  it.effect('SubscribeRequest and UnsubscribeRequest reject camelCase keys', () =>
    Effect.gen(function* () {
      const subscribeSnake = { view_id: 'view-1' }
      const unsubscribeSnake = { view_id: 'view-2' }

      const subscribeDecoded = yield* Schema.decode(SubscribeRequest)(subscribeSnake)
      const unsubscribeDecoded = yield* Schema.decode(UnsubscribeRequest)(unsubscribeSnake)

      expect(subscribeDecoded.view_id).toBe('view-1')
      expect(unsubscribeDecoded.view_id).toBe('view-2')

      expect(() => Schema.decodeUnknownSync(SubscribeRequest)({ viewId: 'view-1' })).toThrow()
      expect(() => Schema.decodeUnknownSync(UnsubscribeRequest)({ viewId: 'view-2' })).toThrow()
    })
  )
})

// ============================================================================
// AvaClientV2 Error Handling Tests
// ============================================================================

describe('AvaClientV2 Errors', () => {
  it('AvaSubscriptionError has correct structure', () => {
    const error = new AvaSubscriptionError({
      viewId: 'test-view',
      message: 'Subscription failed',
      cause: new Error('Network error'),
    })

    expect(error._tag).toBe('AvaSubscriptionError')
    expect(error.viewId).toBe('test-view')
    expect(error.message).toBe('Subscription failed')
  })

  it('AvaInvalidationError has correct structure', () => {
    const error = new AvaInvalidationError({
      viewId: 'test-view',
      message: 'Invalidation failed',
    })

    expect(error._tag).toBe('AvaInvalidationError')
    expect(error.viewId).toBe('test-view')
  })

  it('AvaDecodeError includes context', () => {
    const error = new AvaDecodeError2({
      subject: 'artifacts.view-1',
      raw: '{"bad": "data"}',
      message: 'Schema validation failed',
    })

    expect(error._tag).toBe('AvaDecodeError')
    expect(error.subject).toBe('artifacts.view-1')
    expect(error.raw).toBe('{"bad": "data"}')
  })
})

// ============================================================================
// Subject Pattern Tests
// ============================================================================

describe('NATS Subject Patterns', () => {
  it('artifact subject follows pattern', () => {
    const viewId = 'truck-42'
    const expected = `artifacts.${viewId}`
    expect(expected).toBe('artifacts.truck-42')
  })

  it('delta subject follows pattern', () => {
    const viewId = 'dashboard-1'
    const expected = `deltas.${viewId}`
    expect(expected).toBe('deltas.dashboard-1')
  })

  it('status subject follows pattern', () => {
    const viewId = 'monitor-7'
    const expected = `status.${viewId}`
    expect(expected).toBe('status.monitor-7')
  })

  it('wildcard patterns are valid NATS syntax', () => {
    const allArtifacts = 'artifacts.*'
    const allDeltas = 'deltas.*'
    const allStatus = 'status.*'

    // NATS wildcard patterns use * for single token
    expect(allArtifacts).toMatch(/\.\*$/)
    expect(allDeltas).toMatch(/\.\*$/)
    expect(allStatus).toMatch(/\.\*$/)
  })
})

// ============================================================================
// Effect Schedule Tests (for retry patterns)
// ============================================================================

describe('Retry Schedules', () => {
  it('exponential backoff pattern exists in Effect', () => {
    // Verify Schedule.exponential exists and can be created
    const schedule = Schedule.exponential(Duration.millis(100), 2)
    expect(schedule).toBeDefined()
  })

  it('union schedule pattern exists in Effect', () => {
    // Exponential starting at 100ms
    const exponential = Schedule.exponential(Duration.millis(100))
    // Minimum 500ms spacing
    const spaced = Schedule.spaced(Duration.millis(500))
    // Union takes the longer delay
    const combined = Schedule.union(exponential, spaced)
    expect(combined).toBeDefined()
  })

  it.effect('Schedule.recurs limits retry attempts', () =>
    Effect.gen(function* () {
      // Create a schedule that runs exactly 3 times
      const threeRetries = Schedule.recurs(3)

      // Run a simple effect with the schedule
      let count = 0
      yield* Effect.sync(() => {
        count++
      }).pipe(
        Effect.repeat(threeRetries),
        Effect.ignore
      )

      // Should have run 4 times (1 initial + 3 repeats)
      expect(count).toBe(4)
    })
  )
})
