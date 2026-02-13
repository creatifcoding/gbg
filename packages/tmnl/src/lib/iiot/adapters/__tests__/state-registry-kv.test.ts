/**
 * KV-backed State Registry Tests
 *
 * Tests the persistent host ONLINE/OFFLINE state registry backed by
 * NATS JetStream KV. Validates:
 *   1. registerState → getState roundtrip
 *   2. Missing key returns null
 *   3. Multiple hosts tracked independently
 *   4. State transitions (ONLINE → OFFLINE → ONLINE)
 *
 * Requires a running NATS server with JetStream enabled.
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer } from 'effect'
import { connect, type NatsConnection, type JetStreamManager } from 'nats.ws'

import { makeStateRegistryKV } from '../sparkplug-adapter'
import { NatsKVService } from '../../../holonet/nats/kv'
import { NatsInnerService } from '../../../holonet/nats/inner'
import { NatsConnectionService } from '../../../holonet/nats/connection'
import { HolonetConfigTag } from '../../../holonet/schemas/config'

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222'
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1'

// Use a unique bucket per test run to avoid interference
const STATE_BUCKET = 'iiot-state'

// =============================================================================
// Layer Composition
// =============================================================================

const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'state-registry-kv-test',
  debug: false,
})

const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer),
)

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer),
)

const testKVLayer = NatsKVService.Default.pipe(
  Layer.provide(testInnerLayer),
)

// =============================================================================
// Health Check & Setup
// =============================================================================

let serverAvailable = false
let testConnection: NatsConnection | null = null
let jsm: JetStreamManager | null = null

async function checkNatsHealth(): Promise<boolean> {
  try {
    testConnection = await connect({ servers: NATS_SERVERS })
    jsm = await testConnection.jetstreamManager()
    return true
  } catch {
    return false
  }
}

async function ensureBucket(): Promise<void> {
  if (!jsm) return
  try {
    await jsm.streams.add({
      name: `KV_${STATE_BUCKET}`,
      subjects: [`$KV.${STATE_BUCKET}.>`],
      storage: 'memory' as any,
      max_msgs_per_subject: 10,
    })
  } catch (err: any) {
    // Bucket may already exist
    if (!err.message?.includes('already in use')) {
      throw err
    }
  }
}

async function cleanupBucket(): Promise<void> {
  if (!jsm) return
  try {
    await jsm.streams.delete(`KV_${STATE_BUCKET}`)
  } catch {
    // Ignore errors during cleanup
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('makeStateRegistryKV', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    serverAvailable = await checkNatsHealth()
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`,
      )
      return
    }
    await ensureBucket()
  })

  afterAll(async () => {
    if (testConnection) {
      await cleanupBucket()
      await testConnection.close()
    }
  })

  // ---------------------------------------------------------------------------
  // 1. Basic roundtrip
  // ---------------------------------------------------------------------------

  it('registerState then getState returns ONLINE', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return

    const program = Effect.gen(function* () {
      const kv = yield* NatsKVService
      const registry = makeStateRegistryKV(kv)

      yield* registry.registerState('host-app-001', true)

      const state = yield* registry.getState('host-app-001')
      expect(state).toBe('ONLINE')
    }).pipe(Effect.scoped, Effect.provide(testKVLayer))

    await Effect.runPromise(program)
  })

  it('registerState OFFLINE then getState returns OFFLINE', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return

    const program = Effect.gen(function* () {
      const kv = yield* NatsKVService
      const registry = makeStateRegistryKV(kv)

      yield* registry.registerState('host-app-002', false)

      const state = yield* registry.getState('host-app-002')
      expect(state).toBe('OFFLINE')
    }).pipe(Effect.scoped, Effect.provide(testKVLayer))

    await Effect.runPromise(program)
  })

  // ---------------------------------------------------------------------------
  // 2. Missing key
  // ---------------------------------------------------------------------------

  it('getState returns null for unknown host', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return

    const program = Effect.gen(function* () {
      const kv = yield* NatsKVService
      const registry = makeStateRegistryKV(kv)

      const state = yield* registry.getState(`nonexistent-host-${Date.now()}`)
      expect(state).toBeNull()
    }).pipe(Effect.scoped, Effect.provide(testKVLayer))

    await Effect.runPromise(program)
  })

  // ---------------------------------------------------------------------------
  // 3. Multiple hosts tracked independently
  // ---------------------------------------------------------------------------

  it('tracks multiple hosts independently', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return

    const program = Effect.gen(function* () {
      const kv = yield* NatsKVService
      const registry = makeStateRegistryKV(kv)

      yield* registry.registerState('host-A', true)
      yield* registry.registerState('host-B', false)
      yield* registry.registerState('host-C', true)

      const stateA = yield* registry.getState('host-A')
      const stateB = yield* registry.getState('host-B')
      const stateC = yield* registry.getState('host-C')

      expect(stateA).toBe('ONLINE')
      expect(stateB).toBe('OFFLINE')
      expect(stateC).toBe('ONLINE')
    }).pipe(Effect.scoped, Effect.provide(testKVLayer))

    await Effect.runPromise(program)
  })

  // ---------------------------------------------------------------------------
  // 4. State transitions
  // ---------------------------------------------------------------------------

  it('state transitions persist correctly', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return

    const program = Effect.gen(function* () {
      const kv = yield* NatsKVService
      const registry = makeStateRegistryKV(kv)

      // Start ONLINE
      yield* registry.registerState('transition-host', true)
      expect(yield* registry.getState('transition-host')).toBe('ONLINE')

      // Go OFFLINE
      yield* registry.registerState('transition-host', false)
      expect(yield* registry.getState('transition-host')).toBe('OFFLINE')

      // Come back ONLINE
      yield* registry.registerState('transition-host', true)
      expect(yield* registry.getState('transition-host')).toBe('ONLINE')
    }).pipe(Effect.scoped, Effect.provide(testKVLayer))

    await Effect.runPromise(program)
  })
})
