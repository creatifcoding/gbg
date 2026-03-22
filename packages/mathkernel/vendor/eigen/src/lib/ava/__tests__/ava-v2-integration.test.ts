/**
 * AVA v2 Integration Tests
 *
 * Tests AvaClientV2 and avaV2Runtime against a RUNNING NATS server.
 * These tests require NATS to be running on localhost (docker compose up nats).
 *
 * Run with: npx vitest run src/lib/ava/__tests__/ava-v2-integration.test.ts
 *
 * Skip condition: Set AVA_SKIP_V2_INTEGRATION=1 to skip these tests in CI
 * or when no NATS server is available.
 *
 * Connection strings:
 *   NATS TCP:       nats://localhost:4222
 *   NATS WebSocket: ws://localhost:9222
 *   NATS Monitor:   http://localhost:8222
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Duration, FiberMap, Fiber, Chunk, Schema, HashMap } from 'effect'
import { Registry } from '@effect-atom/atom'

import {
  // Services
  NatsClient,
  NatsClientLive,
  NatsConfigTag,
  AvaClientV2,
  makeAvaClientV2Layer,
  type NatsConfig,
} from '../services'

import {
  // Schemas
  ViewId,
} from '../schemas/v2'

import {
  // Atoms
  avaV2ConfigAtom,
  artifactAtom,
  subscriptionsAtom,
} from '../atoms/v2'

// ============================================================================
// Test Configuration
// ============================================================================

const NATS_WS_URL = (process.env as Record<string, string | undefined>)['NATS_WS_URL'] ?? 'ws://localhost:9222'
const NATS_MONITOR_URL = (process.env as Record<string, string | undefined>)['NATS_MONITOR_URL'] ?? 'http://localhost:8222'
const SKIP_INTEGRATION = (process.env as Record<string, string | undefined>)['AVA_SKIP_V2_INTEGRATION'] === '1'

// ViewId decoder
const decodeViewId = Schema.decodeSync(ViewId)

/** NATS configuration for tests */
const testNatsConfig: NatsConfig = {
  serverUrl: NATS_WS_URL,
  subjectPrefix: 'tmnl.ava.test',
  timeout: 10000,
  maxReconnectAttempts: 0, // Don't retry in tests
  reconnectDelayMs: 1000,
}

/** Test layer composition */
const testLayer = makeAvaClientV2Layer(testNatsConfig, {
  subjectPrefix: 'tmnl.ava.test',
  subscribeTimeout: 10000,
  bufferSize: 100,
})

// ============================================================================
// Health Check
// ============================================================================

let natsAvailable = false

/**
 * Check if NATS server is available via monitoring endpoint
 */
async function checkNatsHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${NATS_MONITOR_URL}/healthz`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

// ============================================================================
// NatsClient Integration Tests
// ============================================================================

describe('NatsClient Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    natsAvailable = await checkNatsHealth()
    if (!natsAvailable) {
      console.warn(`\u26a0\ufe0f  NATS server not available at ${NATS_MONITOR_URL}. Tests will be skipped.`)
    }
  })

  it('connects to NATS WebSocket', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const nats = yield* NatsClient
      const connected = yield* nats.isConnected
      expect(connected).toBe(true)

      const url = yield* nats.serverUrl
      expect(url).toContain('localhost')
    }).pipe(
      Effect.provide(NatsClientLive),
      Effect.provide(Layer.succeed(NatsConfigTag, testNatsConfig)),
      Effect.scoped
    )

    await Effect.runPromise(program)
  })

  it('publishes and subscribes to JSON messages', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const nats = yield* NatsClient
      yield* nats.waitForConnection

      const testSubject = `test.roundtrip.${Date.now()}`
      const testData = { hello: 'world', ts: Date.now() }

      // Start subscription first
      const fiber = yield* nats
        .subscribeJson<typeof testData>(testSubject)
        .pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.timeout(Duration.seconds(5)),
          Effect.fork
        )

      // Small delay to ensure subscription is active
      yield* Effect.sleep(Duration.millis(100))

      // Publish message
      yield* nats.publishJson(testSubject, testData)

      // Wait for message
      const exit = yield* Fiber.await(fiber)
      if (exit._tag !== 'Success') {
        throw new Error('Subscription failed')
      }

      const messages = Chunk.toArray(exit.value)
      expect(messages.length).toBe(1)
      expect(messages[0]?.data).toEqual(testData)
    }).pipe(
      Effect.provide(NatsClientLive),
      Effect.provide(Layer.succeed(NatsConfigTag, testNatsConfig)),
      Effect.scoped
    )

    await Effect.runPromise(program)
  })
})

// ============================================================================
// AvaClientV2 Integration Tests
// ============================================================================

describe('AvaClientV2 Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    natsAvailable = await checkNatsHealth()
    if (!natsAvailable) {
      console.warn(`\u26a0\ufe0f  NATS server not available. AvaClientV2 tests will be skipped.`)
    }
  })

  it('creates client with zero active subscriptions', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const count = yield* client.activeSubscriptions
      expect(count).toBe(0)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('FiberMap starts empty', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const size = yield* FiberMap.size(client.subscriptionFibers)
      expect(size).toBe(0)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('publishes subscribe request to NATS', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const testViewId = decodeViewId(`test-subscribe-${Date.now()}`)

      // Request subscription - this publishes to NATS
      yield* client.requestSubscribe(testViewId)

      // If no error, publish succeeded
      expect(true).toBe(true)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('publishes invalidation request to NATS', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const testViewId = decodeViewId(`test-invalidate-${Date.now()}`)

      // Invalidate - this publishes to NATS
      yield* client.invalidate(testViewId, 'integration test')

      // If no error, publish succeeded
      expect(true).toBe(true)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('publishes unsubscribe request to NATS', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const testViewId = decodeViewId(`test-unsubscribe-${Date.now()}`)

      // Unsubscribe - this publishes to NATS
      yield* client.requestUnsubscribe(testViewId)

      // If no error, publish succeeded
      expect(true).toBe(true)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })
})

// ============================================================================
// Atom Integration Tests (with Registry)
// ============================================================================

describe('avaV2Runtime Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    natsAvailable = await checkNatsHealth()
    if (!natsAvailable) {
      console.warn(`\u26a0\ufe0f  NATS server not available. Atom tests will be skipped.`)
    }
  })

  it('config atom has default values', () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const registry = Registry.make()
    const config = registry.get(avaV2ConfigAtom)

    expect(config.natsUrl).toBe('ws://localhost:9222')
    expect(config.subjectPrefix).toBe('tmnl.ava')
  })

  it('config atom can be updated', () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const registry = Registry.make()
    registry.set(avaV2ConfigAtom, {
      natsUrl: 'ws://custom:9222',
      subjectPrefix: 'custom.ava',
    })

    const config = registry.get(avaV2ConfigAtom)
    expect(config.natsUrl).toBe('ws://custom:9222')
    expect(config.subjectPrefix).toBe('custom.ava')
  })

  it('artifactAtom family returns null for unknown view', () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const registry = Registry.make()
    const testViewId = decodeViewId('test-view')
    const artifact = registry.get(artifactAtom(testViewId))

    // No artifact for unknown view
    expect(artifact).toBeNull()
  })

  it('subscriptionsAtom starts empty', () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const registry = Registry.make()
    const subs = registry.get(subscriptionsAtom)

    // Empty HashMap
    expect(HashMap.size(subs)).toBe(0)
  })
})

// ============================================================================
// FiberMap Lifecycle Tests
// ============================================================================

describe('FiberMap Lifecycle', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    natsAvailable = await checkNatsHealth()
  })

  it('FiberMap.run adds fiber, FiberMap.remove cleans up', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const testViewId = decodeViewId(`fibermap-test-${Date.now()}`)

      // Initially empty
      const initialSize = yield* FiberMap.size(client.subscriptionFibers)
      expect(initialSize).toBe(0)

      // Run a long-running fiber
      yield* FiberMap.run(
        client.subscriptionFibers,
        testViewId,
        Effect.sleep(Duration.minutes(1)), // Long running
        { onlyIfMissing: true }
      )

      // Should have 1 fiber
      const afterRunSize = yield* FiberMap.size(client.subscriptionFibers)
      expect(afterRunSize).toBe(1)

      // Check it exists
      const hasFiber = yield* FiberMap.has(client.subscriptionFibers, testViewId)
      expect(hasFiber).toBe(true)

      // Remove it
      yield* FiberMap.remove(client.subscriptionFibers, testViewId)

      // Should be empty again
      const afterRemoveSize = yield* FiberMap.size(client.subscriptionFibers)
      expect(afterRemoveSize).toBe(0)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('FiberMap.clear removes all fibers', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2

      // Add multiple fibers
      yield* FiberMap.run(
        client.subscriptionFibers,
        decodeViewId('clear-test-1'),
        Effect.sleep(Duration.minutes(1)),
        { onlyIfMissing: true }
      )
      yield* FiberMap.run(
        client.subscriptionFibers,
        decodeViewId('clear-test-2'),
        Effect.sleep(Duration.minutes(1)),
        { onlyIfMissing: true }
      )

      const beforeClear = yield* FiberMap.size(client.subscriptionFibers)
      expect(beforeClear).toBe(2)

      // Clear all
      yield* FiberMap.clear(client.subscriptionFibers)

      const afterClear = yield* FiberMap.size(client.subscriptionFibers)
      expect(afterClear).toBe(0)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })

  it('onlyIfMissing prevents duplicate fibers', async () => {
    if (SKIP_INTEGRATION || !natsAvailable) return

    const program = Effect.gen(function* () {
      const client = yield* AvaClientV2
      const testViewId = decodeViewId('duplicate-test')

      // First run
      yield* FiberMap.run(
        client.subscriptionFibers,
        testViewId,
        Effect.sleep(Duration.minutes(1)),
        { onlyIfMissing: true }
      )

      const firstSize = yield* FiberMap.size(client.subscriptionFibers)
      expect(firstSize).toBe(1)

      // Second run with onlyIfMissing - should not add another
      yield* FiberMap.run(
        client.subscriptionFibers,
        testViewId,
        Effect.sleep(Duration.minutes(1)),
        { onlyIfMissing: true }
      )

      const secondSize = yield* FiberMap.size(client.subscriptionFibers)
      expect(secondSize).toBe(1) // Still 1, not 2

      // Cleanup
      yield* FiberMap.clear(client.subscriptionFibers)
    }).pipe(Effect.provide(testLayer), Effect.scoped)

    await Effect.runPromise(program)
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('handles connection failure gracefully', async () => {
    // Use invalid NATS URL
    const badConfig: NatsConfig = {
      serverUrl: 'ws://localhost:59999', // Invalid port
      subjectPrefix: 'test',
      timeout: 2000,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 100,
    }

    const badLayer = NatsClientLive.pipe(
      Layer.provide(Layer.succeed(NatsConfigTag, badConfig))
    )

    const program = Effect.gen(function* () {
      const nats = yield* NatsClient
      return yield* nats.waitForConnection
    }).pipe(
      Effect.provide(badLayer),
      Effect.scoped,
      Effect.timeout(Duration.seconds(5)),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    // Should fail (Left) or timeout
    // Either outcome is acceptable for a bad connection
    expect(result._tag).toBe('Left')
  })
})
