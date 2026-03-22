/**
 * Sparkplug E2E Integration Tests (F27.5.3)
 *
 * Tests the full adapter pipeline using mock transports (no real broker):
 * - NBIRTH -> DDATA with alias resolution -> IngestedReading output
 * - NDEATH -> aliases cleared
 * - Malformed payload -> error count incremented
 * - Multi-group subscription
 * - STATE message handling through processMessage
 *
 * Uses plain vitest `it()` + `Effect.runPromise` wrapper.
 *
 * @see sparkplug-adapter.ts
 * @see sparkplug-pipeline.test.ts (layer composition tests)
 */

import { describe, it, expect } from 'vitest'
import { DateTime, Effect, Ref } from 'effect'
import {
  processMessage,
  makeAliasRegistry,
  makeStateRegistry,
  makeNodeKey,
} from '../sparkplug-adapter'
import { type TopicRouterShape } from '../device-routing'
import { type IngestionHealth, IngestedReading } from '../ingestion'
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

/** Helper to build a protobuf BIRTH payload with alias mappings */
const buildBirthPayload = (
  metrics: Array<{ name: string; alias: number; type: string; value: unknown }>,
) =>
  Buffer.from(
    encodePayload({
      timestamp: Date.now(),
      metrics: metrics.map((m) => ({
        name: m.name,
        alias: m.alias,
        type: m.type,
        value: m.value,
      })),
    }),
  )

/** Helper to build a protobuf DATA payload (with aliases, no names) */
const buildDataPayload = (
  metrics: Array<{ alias: number; type: string; value: unknown }>,
) =>
  Buffer.from(
    encodePayload({
      timestamp: Date.now(),
      metrics: metrics.map((m) => ({
        alias: m.alias,
        type: m.type,
        value: m.value,
      })),
    }),
  )

/** Helper to build a protobuf DATA payload with named metrics */
const buildNamedDataPayload = (
  metrics: Array<{ name: string; type: string; value: unknown }>,
) =>
  Buffer.from(
    encodePayload({
      timestamp: Date.now(),
      metrics: metrics.map((m) => ({
        name: m.name,
        type: m.type,
        value: m.value,
      })),
    }),
  )

// =============================================================================
// E2E Scenario 1: NBIRTH -> DDATA with alias resolution
// =============================================================================

describe('E2E: NBIRTH -> DDATA alias resolution', () => {
  it('resolves aliases established by NBIRTH in subsequent NDATA', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Step 1: NBIRTH establishes alias mappings
        const birthPayload = buildBirthPayload([
          { name: 'Temperature', alias: 1, type: 'Double', value: 0 },
          { name: 'Pressure', alias: 2, type: 'Double', value: 0 },
          { name: 'FlowRate', alias: 3, type: 'Float', value: 0 },
        ])

        const birthReadings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/NBIRTH/edge-01', payload: birthPayload },
        )
        expect(birthReadings).toHaveLength(0)

        // Step 2: NDATA uses aliases
        const dataPayload = buildDataPayload([
          { alias: 1, type: 'Double', value: 72.5 },
          { alias: 2, type: 'Double', value: 3.14 },
          { alias: 3, type: 'Float', value: 150.0 },
        ])

        const dataReadings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/NDATA/edge-01', payload: dataPayload },
        )

        expect(dataReadings).toHaveLength(3)
        expect(dataReadings[0]!.value).toBe(72.5)
        expect(dataReadings[0]!.topic).toContain('Temperature')
        expect(dataReadings[1]!.value).toBeCloseTo(3.14, 1)
        expect(dataReadings[1]!.topic).toContain('Pressure')
        expect(dataReadings[2]!.value).toBeCloseTo(150.0, 0)
        expect(dataReadings[2]!.topic).toContain('FlowRate')
      }),
    )
  })

  it('resolves aliases from DBIRTH in subsequent DDATA', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // DBIRTH for a device
        const birthPayload = buildBirthPayload([
          { name: 'RPM', alias: 10, type: 'Int32', value: 0 },
          { name: 'Current', alias: 11, type: 'Double', value: 0 },
        ])

        yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/DBIRTH/edge-01/motor-01', payload: birthPayload },
        )

        // DDATA for same device using aliases
        const dataPayload = buildDataPayload([
          { alias: 10, type: 'Int32', value: 3600 },
          { alias: 11, type: 'Double', value: 45.2 },
        ])

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/DDATA/edge-01/motor-01', payload: dataPayload },
        )

        expect(readings).toHaveLength(2)
        expect(readings[0]!.value).toBe(3600)
        expect(readings[0]!.topic).toBe('spBv1.0/plant-a/DDATA/edge-01/motor-01/RPM')
        expect(readings[1]!.value).toBe(45.2)
        expect(readings[1]!.topic).toBe('spBv1.0/plant-a/DDATA/edge-01/motor-01/Current')
      }),
    )
  })

  it('emits readings with named metrics (no alias needed)', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const dataPayload = buildNamedDataPayload([
          { name: 'Temperature', type: 'Double', value: 25.0 },
        ])

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01', payload: dataPayload },
        )

        expect(readings).toHaveLength(1)
        expect(readings[0]!.value).toBe(25.0)
        expect(readings[0]!.topic).toBe('spBv1.0/plant-a/DDATA/edge-01/sensor-01/Temperature')
      }),
    )
  })

  it('skips metrics with unresolvable alias (no prior BIRTH)', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // No BIRTH, alias 99 is unknown
        const dataPayload = buildDataPayload([
          { alias: 99, type: 'Double', value: 42.0 },
        ])

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/NDATA/edge-01', payload: dataPayload },
        )

        // Should skip — alias not resolved, no name
        expect(readings).toHaveLength(0)
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 2: NDEATH -> aliases cleared
// =============================================================================

describe('E2E: NDEATH clears aliases', () => {
  it('clears all aliases for an edge node on NDEATH', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Step 1: NBIRTH establishes aliases
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'Temp', alias: 1, type: 'Double', value: 0 },
              { name: 'Humidity', alias: 2, type: 'Double', value: 0 },
            ]),
          },
        )

        // Step 2: Verify aliases resolve
        const nodeKey = makeNodeKey('plant-a', 'edge-01')
        expect(yield* aliasReg.resolveAlias(nodeKey, 1)).toBe('Temp')
        expect(yield* aliasReg.resolveAlias(nodeKey, 2)).toBe('Humidity')

        // Step 3: NDEATH
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: buildBirthPayload([]), // Empty death payload
          },
        )

        // Step 4: Aliases are gone
        expect(yield* aliasReg.resolveAlias(nodeKey, 1)).toBeNull()
        expect(yield* aliasReg.resolveAlias(nodeKey, 2)).toBeNull()
      }),
    )
  })

  it('NDEATH does not affect other edge nodes', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // NBIRTH for edge-01
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'Temp-01', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NBIRTH for edge-02
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-02',
            payload: buildBirthPayload([
              { name: 'Temp-02', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NDEATH for edge-01 only
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: buildBirthPayload([]),
          },
        )

        // edge-01 aliases cleared, edge-02 intact
        const key1 = makeNodeKey('plant-a', 'edge-01')
        const key2 = makeNodeKey('plant-a', 'edge-02')
        expect(yield* aliasReg.resolveAlias(key1, 1)).toBeNull()
        expect(yield* aliasReg.resolveAlias(key2, 1)).toBe('Temp-02')
      }),
    )
  })

  it('DDATA after NDEATH fails to resolve stale aliases', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // NBIRTH -> aliases
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'Temp', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NDEATH -> clear
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: buildBirthPayload([]),
          },
        )

        // NDATA with alias 1 -> should produce no readings (alias gone)
        const dataPayload = buildDataPayload([
          { alias: 1, type: 'Double', value: 99.0 },
        ])
        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/plant-a/NDATA/edge-01', payload: dataPayload },
        )

        expect(readings).toHaveLength(0)
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 3: Malformed payload -> error count incremented
// =============================================================================

describe('E2E: malformed payload handling', () => {
  it('increments errorCount for non-protobuf payload', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: Buffer.from('garbage-not-protobuf'),
          },
        )

        const health = yield* Ref.get(healthRef)
        expect(health.errorCount).toBe(1)
      }),
    )
  })

  it('accumulates error count across multiple malformed messages', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Send 3 malformed payloads
        for (let i = 0; i < 3; i++) {
          yield* processMessage(
            aliasReg, stateReg, healthRef,
            {
              topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
              payload: Buffer.from(`bad-data-${i}`),
            },
          )
        }

        const health = yield* Ref.get(healthRef)
        expect(health.errorCount).toBe(3)
      }),
    )
  })

  it('returns empty readings on malformed payload', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDATA/edge-01',
            payload: Buffer.from(new Uint8Array([0xff, 0xfe, 0xfd])),
          },
        )

        expect(readings).toHaveLength(0)
      }),
    )
  })

  it('valid messages still work after malformed ones', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Malformed
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: Buffer.from('bad'),
          },
        )

        // Valid named DDATA
        const validPayload = buildNamedDataPayload([
          { name: 'Temp', type: 'Double', value: 42.0 },
        ])
        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: validPayload,
          },
        )

        expect(readings).toHaveLength(1)
        expect(readings[0]!.value).toBe(42.0)

        // Error count still 1 from the malformed one
        const health = yield* Ref.get(healthRef)
        expect(health.errorCount).toBe(1)
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 4: Multi-group subscription
// =============================================================================

describe('E2E: multi-group message handling', () => {
  it('handles messages from different groups with separate alias namespaces', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // NBIRTH for plant-a/edge-01
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'TempA', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NBIRTH for plant-b/edge-01 (same edge name, different group)
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-b/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'TempB', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NDATA from plant-a — alias 1 should resolve to TempA
        const readingsA = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDATA/edge-01',
            payload: buildDataPayload([{ alias: 1, type: 'Double', value: 20.0 }]),
          },
        )

        // NDATA from plant-b — alias 1 should resolve to TempB
        const readingsB = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-b/NDATA/edge-01',
            payload: buildDataPayload([{ alias: 1, type: 'Double', value: 30.0 }]),
          },
        )

        expect(readingsA).toHaveLength(1)
        expect(readingsA[0]!.topic).toContain('TempA')
        expect(readingsA[0]!.value).toBe(20.0)

        expect(readingsB).toHaveLength(1)
        expect(readingsB[0]!.topic).toContain('TempB')
        expect(readingsB[0]!.value).toBe(30.0)
      }),
    )
  })

  it('NDEATH in one group does not affect another', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Both groups have alias 1
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'TempA', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-b/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'TempB', alias: 1, type: 'Double', value: 0 },
            ]),
          },
        )

        // NDEATH only for plant-a
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: buildBirthPayload([]),
          },
        )

        // plant-a alias gone
        const keyA = makeNodeKey('plant-a', 'edge-01')
        expect(yield* aliasReg.resolveAlias(keyA, 1)).toBeNull()

        // plant-b alias intact
        const keyB = makeNodeKey('plant-b', 'edge-01')
        expect(yield* aliasReg.resolveAlias(keyB, 1)).toBe('TempB')
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 5: Full lifecycle — NBIRTH -> DBIRTH -> DDATA -> NDEATH -> re-NBIRTH
// =============================================================================

describe('E2E: full lifecycle', () => {
  it('handles complete BIRTH -> DATA -> DEATH -> re-BIRTH cycle', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()
        const { router, registered } = makeMockRouter()

        // 1. NBIRTH
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'NodeMetric', alias: 100, type: 'Double', value: 0 },
            ]),
          },
          router,
        )
        expect(registered).toHaveLength(0) // NBIRTH = no route

        // 2. DBIRTH for device
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DBIRTH/edge-01/pump-01',
            payload: buildBirthPayload([
              { name: 'RPM', alias: 1, type: 'Int32', value: 0 },
              { name: 'Pressure', alias: 2, type: 'Double', value: 0 },
            ]),
          },
          router,
        )
        expect(registered).toHaveLength(1) // DBIRTH = route registered
        expect(registered[0]!.deviceId).toBe('edge-01:pump-01')

        // 3. DDATA with aliases
        const dataReadings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/pump-01',
            payload: buildDataPayload([
              { alias: 1, type: 'Int32', value: 1800 },
              { alias: 2, type: 'Double', value: 5.5 },
            ]),
          },
          router,
        )
        expect(dataReadings).toHaveLength(2)
        expect(dataReadings[0]!.topic).toBe('spBv1.0/plant-a/DDATA/edge-01/pump-01/RPM')
        expect(dataReadings[0]!.value).toBe(1800)
        expect(dataReadings[1]!.topic).toBe('spBv1.0/plant-a/DDATA/edge-01/pump-01/Pressure')
        expect(dataReadings[1]!.value).toBe(5.5)

        // 4. NDEATH — clears aliases
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NDEATH/edge-01',
            payload: buildBirthPayload([]),
          },
          router,
        )

        const nodeKey = makeNodeKey('plant-a', 'edge-01')
        expect(yield* aliasReg.resolveAlias(nodeKey, 1)).toBeNull()
        expect(yield* aliasReg.resolveAlias(nodeKey, 100)).toBeNull()

        // 5. Re-NBIRTH with different aliases
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'NewMetric', alias: 100, type: 'Double', value: 0 },
            ]),
          },
          router,
        )
        expect(yield* aliasReg.resolveAlias(nodeKey, 100)).toBe('NewMetric')
      }),
    )
  })

  it('updates lastMessageAt on DDATA', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        // Initial health has no lastMessageAt
        const healthBefore = yield* Ref.get(healthRef)
        expect(healthBefore.lastMessageAt).toBeUndefined()

        // Send DDATA
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: buildNamedDataPayload([
              { name: 'Temp', type: 'Double', value: 25.0 },
            ]),
          },
        )

        const healthAfter = yield* Ref.get(healthRef)
        expect(healthAfter.lastMessageAt).toBeDefined()
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 6: STATE + DBIRTH combined
// =============================================================================

describe('E2E: STATE + protocol messages combined', () => {
  it('handles interleaved STATE and protocol messages', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()
        const { router, registered } = makeMockRouter()

        // STATE ONLINE
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/STATE/scada-primary', payload: Buffer.from('ONLINE') },
          router,
        )
        expect(yield* stateReg.getState('scada-primary')).toBe('ONLINE')

        // NBIRTH
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/NBIRTH/edge-01',
            payload: buildBirthPayload([
              { name: 'Temp', alias: 1, type: 'Double', value: 0 },
            ]),
          },
          router,
        )

        // DBIRTH
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DBIRTH/edge-01/sensor-01',
            payload: buildBirthPayload([
              { name: 'Humidity', alias: 2, type: 'Double', value: 0 },
            ]),
          },
          router,
        )
        expect(registered).toHaveLength(1)

        // DDATA
        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: buildDataPayload([
              { alias: 2, type: 'Double', value: 65.0 },
            ]),
          },
          router,
        )
        expect(readings).toHaveLength(1)
        expect(readings[0]!.value).toBe(65.0)

        // STATE OFFLINE
        yield* processMessage(
          aliasReg, stateReg, healthRef,
          { topic: 'spBv1.0/STATE/scada-primary', payload: Buffer.from('OFFLINE') },
          router,
        )
        expect(yield* stateReg.getState('scada-primary')).toBe('OFFLINE')
      }),
    )
  })
})

// =============================================================================
// E2E Scenario 7: IngestedReading shape verification
// =============================================================================

describe('E2E: IngestedReading shape', () => {
  it('each reading is an IngestedReading instance with correct fields', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/plant-a/DDATA/edge-01/sensor-01',
            payload: buildNamedDataPayload([
              { name: 'Temperature', type: 'Double', value: 37.5 },
            ]),
          },
        )

        expect(readings).toHaveLength(1)
        const reading = readings[0]!

        expect(reading).toBeInstanceOf(IngestedReading)
        expect(reading._tag).toBe('IngestedReading')
        expect(typeof reading.value).toBe('number')
        expect(typeof reading.topic).toBe('string')
        expect(reading.sourceTimestamp).toBeDefined()
      }),
    )
  })

  it('DDATA topic includes metric name at end', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/factory/DDATA/node-x/dev-y',
            payload: buildNamedDataPayload([
              { name: 'Vibration', type: 'Double', value: 12.3 },
            ]),
          },
        )

        expect(readings[0]!.topic).toBe('spBv1.0/factory/DDATA/node-x/dev-y/Vibration')
      }),
    )
  })

  it('NDATA topic (no deviceId) includes metric name', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const aliasReg = yield* makeAliasRegistry
        const stateReg = yield* makeStateRegistry
        const healthRef = yield* makeHealthRef()

        const readings = yield* processMessage(
          aliasReg, stateReg, healthRef,
          {
            topic: 'spBv1.0/factory/NDATA/node-x',
            payload: buildNamedDataPayload([
              { name: 'CPULoad', type: 'Double', value: 0.85 },
            ]),
          },
        )

        expect(readings[0]!.topic).toBe('spBv1.0/factory/NDATA/node-x/CPULoad')
      }),
    )
  })
})
