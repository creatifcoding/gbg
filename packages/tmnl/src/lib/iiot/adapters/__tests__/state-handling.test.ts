/**
 * STATE handling + dynamic route registration tests (F27.3.3-4)
 *
 * Tests for:
 * 1. parseStateTopic — parsing `spBv1.0/STATE/{host_app_id}` topics
 * 2. makeStateRegistry — HashMap-backed host app state tracking
 * 3. processMessage STATE handling — JSON payload (not protobuf)
 * 4. processMessage DBIRTH dynamic route registration
 *
 * Uses plain vitest `it()` + `Effect.runPromise` for PubSub-free tests.
 *
 * @see sparkplug-b-plan.md Decision 7 (STATE Message Handling)
 * @see sparkplug-adapter.ts
 */

import { describe, it, expect } from 'vitest'
import { DateTime, Effect, Ref } from 'effect'
import {
  parseStateTopic,
  makeStateRegistry,
  processMessage,
  makeAliasRegistry,
  makeNodeKey,
} from '../sparkplug-adapter'
import { type TopicRouterShape } from '../device-routing'
import { type IngestionHealth } from '../ingestion'
import { encodePayload } from '@selfcharters/sparkplug-client'

// =============================================================================
// Helpers
// =============================================================================

const makeHealthRef = () =>
  Ref.make<IngestionHealth>({
    protocol: 'sparkplug',
    connected: false,
    errorCount: 0,
  })

/** Create a mock TopicRouter that records register calls */
const makeMockRouter = () => {
  const registered: Array<{ topicPattern: string; deviceId: string }> = []
  const router: TopicRouterShape = {
    resolve: () => Effect.succeed(null),
    register: (route) =>
      Effect.sync(() => {
        registered.push({ topicPattern: route.topicPattern, deviceId: route.deviceId })
      }),
    registerBatch: (routes) =>
      Effect.forEach(routes, (r) =>
        Effect.sync(() => {
          registered.push({ topicPattern: r.topicPattern, deviceId: r.deviceId })
        }),
        { discard: true },
      ),
  }
  return { router, registered }
}

// =============================================================================
// parseStateTopic
// =============================================================================

describe('parseStateTopic', () => {
  it('parses valid STATE topic', () => {
    const result = parseStateTopic('spBv1.0/STATE/scada-host-01')
    expect(result).toEqual({ hostAppId: 'scada-host-01' })
  })

  it('parses STATE topic with hyphenated host id', () => {
    const result = parseStateTopic('spBv1.0/STATE/my-primary-host')
    expect(result).toEqual({ hostAppId: 'my-primary-host' })
  })

  it('returns null for non-STATE topic', () => {
    const result = parseStateTopic('spBv1.0/plant-a/DDATA/edge-01/sensor-01')
    expect(result).toBeNull()
  })

  it('returns null for malformed STATE topic (missing host id)', () => {
    const result = parseStateTopic('spBv1.0/STATE')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseStateTopic('')
    expect(result).toBeNull()
  })

  it('returns null for non-sparkplug topic', () => {
    const result = parseStateTopic('some/random/topic')
    expect(result).toBeNull()
  })
})

// =============================================================================
// makeStateRegistry
// =============================================================================

describe('makeStateRegistry', () => {
  it('registers host app as ONLINE', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        yield* registry.registerState('host-01', true)
        const state = yield* registry.getState('host-01')
        expect(state).toBe('ONLINE')
      }),
    )
  })

  it('registers host app as OFFLINE', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        yield* registry.registerState('host-01', false)
        const state = yield* registry.getState('host-01')
        expect(state).toBe('OFFLINE')
      }),
    )
  })

  it('returns null for unknown host', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        const state = yield* registry.getState('unknown-host')
        expect(state).toBeNull()
      }),
    )
  })

  it('transitions ONLINE to OFFLINE', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        yield* registry.registerState('host-01', true)
        expect(yield* registry.getState('host-01')).toBe('ONLINE')
        yield* registry.registerState('host-01', false)
        expect(yield* registry.getState('host-01')).toBe('OFFLINE')
      }),
    )
  })

  it('transitions OFFLINE back to ONLINE', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        yield* registry.registerState('host-01', false)
        yield* registry.registerState('host-01', true)
        expect(yield* registry.getState('host-01')).toBe('ONLINE')
      }),
    )
  })

  it('tracks multiple hosts independently', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* makeStateRegistry
        yield* registry.registerState('host-01', true)
        yield* registry.registerState('host-02', false)
        expect(yield* registry.getState('host-01')).toBe('ONLINE')
        expect(yield* registry.getState('host-02')).toBe('OFFLINE')
      }),
    )
  })
})

// =============================================================================
// processMessage — STATE handling
// =============================================================================

describe('processMessage STATE handling', () => {
  it('handles ONLINE state message', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const onlinePayload = Buffer.from(JSON.stringify({ online: true, timestamp: Date.now() }))

        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          { topic: 'spBv1.0/STATE/scada-host-01', payload: onlinePayload },
        )

        expect(readings).toEqual([])
        const state = yield* stateReg.getState('scada-host-01')
        expect(state).toBe('ONLINE')
      }),
    )
  })

  it('handles OFFLINE state message', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const offlinePayload = Buffer.from(JSON.stringify({ online: false, timestamp: Date.now() }))

        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          { topic: 'spBv1.0/STATE/scada-host-01', payload: offlinePayload },
        )

        expect(readings).toEqual([])
        const state = yield* stateReg.getState('scada-host-01')
        expect(state).toBe('OFFLINE')
      }),
    )
  })

  it('handles plain string ONLINE payload', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Sparkplug spec says STATE payload can be plain "ONLINE"/"OFFLINE" string
        const onlinePayload = Buffer.from('ONLINE')

        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          { topic: 'spBv1.0/STATE/scada-host-01', payload: onlinePayload },
        )

        expect(readings).toEqual([])
        const state = yield* stateReg.getState('scada-host-01')
        expect(state).toBe('ONLINE')
      }),
    )
  })

  it('handles plain string OFFLINE payload', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const offlinePayload = Buffer.from('OFFLINE')

        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          { topic: 'spBv1.0/STATE/scada-host-01', payload: offlinePayload },
        )

        expect(readings).toEqual([])
        const state = yield* stateReg.getState('scada-host-01')
        expect(state).toBe('OFFLINE')
      }),
    )
  })

  it('returns empty readings for STATE messages', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const payload = Buffer.from('ONLINE')
        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          { topic: 'spBv1.0/STATE/host-01', payload },
        )

        // STATE messages never produce readings
        expect(readings).toHaveLength(0)
      }),
    )
  })
})

// =============================================================================
// processMessage — DBIRTH dynamic route registration
// =============================================================================

describe('processMessage DBIRTH dynamic route registration', () => {
  it('registers route on DBIRTH when router is provided', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()
        const { router, registered } = makeMockRouter()

        // Build a DBIRTH protobuf payload with metrics
        const payload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
            { name: 'Pressure', alias: 2, type: 'Double', value: 0 },
          ],
        })

        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/DBIRTH/edge-01/sensor-01',
            payload: Buffer.from(payload),
          },
          router,
        )

        // Should register a route for this device
        expect(registered.length).toBe(1)
        expect(registered[0]!.topicPattern).toBe(
          'spBv1.0/plant-a/DDATA/edge-01/sensor-01/*',
        )
        expect(registered[0]!.deviceId).toBe('edge-01:sensor-01')
      }),
    )
  })

  it('does not register route when no router provided', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const payload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
          ],
        })

        // No router — should not throw
        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/DBIRTH/edge-01/sensor-01',
            payload: Buffer.from(payload),
          },
        )

        expect(readings).toEqual([])
      }),
    )
  })

  it('does not register route on NBIRTH (node-level, no device)', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()
        const { router, registered } = makeMockRouter()

        const payload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'NodeMetric', alias: 1, type: 'Double', value: 0 },
          ],
        })

        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: Buffer.from(payload),
          },
          router,
        )

        // NBIRTH is node-level — no device route registration
        expect(registered.length).toBe(0)
      }),
    )
  })

  it('still registers aliases on DBIRTH alongside route', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()
        const { router } = makeMockRouter()

        const payload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
            { name: 'Pressure', alias: 2, type: 'Double', value: 0 },
          ],
        })

        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/DBIRTH/edge-01/sensor-01',
            payload: Buffer.from(payload),
          },
          router,
        )

        // Verify aliases were registered
        const nodeKey = makeNodeKey('plant-a', 'edge-01')
        const resolved1 = yield* aliasReg.resolveAlias(nodeKey, 1)
        const resolved2 = yield* aliasReg.resolveAlias(nodeKey, 2)
        expect(resolved1).toBe('Temperature')
        expect(resolved2).toBe('Pressure')
      }),
    )
  })
})

// =============================================================================
// processMessage — existing behavior regression
// =============================================================================

describe('processMessage regression', () => {
  it('still handles DDATA with stateRegistry param', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Register aliases first via NBIRTH
        const birthPayload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
          ],
        })
        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: Buffer.from(birthPayload),
          },
        )

        // Send DDATA with alias
        const dataPayload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { alias: 1, type: 'Double', value: 42.5 },
          ],
        })
        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/NDATA/edge-01',
            payload: Buffer.from(dataPayload),
          },
        )

        expect(readings.length).toBe(1)
        expect(readings[0]!.value).toBe(42.5)
      }),
    )
  })

  it('still handles NDEATH with stateRegistry param', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Register aliases
        const birthPayload = encodePayload({
          timestamp: Date.now(),
          metrics: [
            { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
          ],
        })
        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: Buffer.from(birthPayload),
          },
        )

        // Verify alias exists
        const nodeKey = makeNodeKey('plant-a', 'edge-01')
        expect(yield* aliasReg.resolveAlias(nodeKey, 1)).toBe('Temperature')

        // NDEATH clears aliases
        const deathPayload = encodePayload({
          timestamp: Date.now(),
          metrics: [],
        })
        yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: Buffer.from(deathPayload),
          },
        )

        expect(yield* aliasReg.resolveAlias(nodeKey, 1)).toBeNull()
      }),
    )
  })

  it('increments errorCount on malformed payload with stateRegistry param', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const readings = yield* processMessage(
          aliasReg,
          stateReg,
          healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: Buffer.from('not-a-protobuf'),
          },
        )

        expect(readings).toEqual([])
        const health = yield* Ref.get(healthRef)
        expect(health.errorCount).toBe(1)
      }),
    )
  })
})
