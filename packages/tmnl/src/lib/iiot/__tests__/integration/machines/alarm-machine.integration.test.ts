/**
 * AlarmMachine Integration Tests
 *
 * Tests the AlarmMachine with real PostgreSQL-backed state services
 * and SQL EventJournal. Verifies ISA-18.2 state transitions,
 * event emission, and EventLog persistence against a live database.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/integration/machines/alarm-machine.integration.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/integration/machines/alarm-machine
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeAlarmMachine,
  InternalCreateAlarm,
  InternalGetAlarm,
  InternalAcknowledgeAlarm,
  InternalClearAlarm,
} from '../../../machines/AlarmMachine'
import { AlarmState } from '../../../state'
import { IIoTFeatureFlags } from '../../../infrastructure/feature-flags'
import type { CreateAlarmParams } from '../../../schemas/alarms'
import type { DeviceId } from '../../../schemas/identifiers'
import {
  AlarmMachineIntegrationLayer,
  cleanMachineTestData,
  setupMachineTestHierarchy,
  setupTestMachine,
  setupTestSensor,
} from './layer'

// =============================================================================
// Environment Gate
// =============================================================================

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestAlarmParams = (overrides?: Partial<{
  deviceId: string
  alarmType: string
  severity: string
  message: string
}>): CreateAlarmParams => ({
  deviceId: (overrides?.deviceId ?? 'TEST-SENSOR-001') as DeviceId,
  alarmType: (overrides?.alarmType ?? 'high_temperature') as CreateAlarmParams['alarmType'],
  severity: (overrides?.severity ?? 'critical') as CreateAlarmParams['severity'],
  message: overrides?.message ?? 'Integration test alarm',
})

/**
 * Boot an AlarmMachine actor with injected state + flags from the layer.
 */
const bootAlarmActor = Effect.gen(function* () {
  const state = yield* AlarmState
  const flags = yield* IIoTFeatureFlags
  const machine = makeAlarmMachine({ state, flags })
  return yield* Machine.boot(machine)
})


// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!RUN)('AlarmMachine Integration', () => {
  // ---------------------------------------------------------------------------
  // 1. CREATE with EventLog verification
  // ---------------------------------------------------------------------------
  describe('CREATE with EventLog verification', () => {
    it.effect('creates alarm persisted to SQL and emits event log entry', () =>
      Effect.gen(function* () {
        // Clean state
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-001')
        yield* setupTestSensor('TEST-SENSOR-001', 'TEST-MCH-ALM-001')

        const actor = yield* bootAlarmActor

        // CREATE alarm
        const alarm = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        // Verify alarm fields
        expect(alarm.deviceId).toBe('TEST-SENSOR-001')
        expect(alarm.alarmType).toBe('high_temperature')
        expect(alarm.severity).toBe('critical')
        expect(alarm.state).toBe('unacknowledged')
        expect(alarm.id).toBeDefined()

        // Verify alarm was persisted (GET round-trip)
        const fetched = yield* actor.send(
          new InternalGetAlarm({ alarmId: alarm.id })
        )
        expect(fetched.id).toBe(alarm.id)
        expect(fetched.deviceId).toBe(alarm.deviceId)
        expect(fetched.state).toBe('unacknowledged')

        // Cleanup
        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 2. ACKNOWLEDGE with event emission
  // ---------------------------------------------------------------------------
  describe('ACKNOWLEDGE with event emission', () => {
    it.effect('acknowledges alarm and transitions state correctly', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-002')
        yield* setupTestSensor('TEST-SENSOR-002', 'TEST-MCH-ALM-002')

        const actor = yield* bootAlarmActor

        // Create alarm
        const alarm = yield* actor.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-002' }),
          })
        )
        expect(alarm.state).toBe('unacknowledged')

        // Acknowledge
        const acknowledged = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-integration-001',
          })
        )

        expect(acknowledged.state).toBe('acknowledged')
        expect(acknowledged.acknowledgedBy).toBe('operator-integration-001')
        expect(acknowledged.acknowledgedAt).toBeDefined()

        // Verify via GET (round-trip through SQL)
        const fetched = yield* actor.send(
          new InternalGetAlarm({ alarmId: alarm.id })
        )
        expect(fetched.state).toBe('acknowledged')
        expect(fetched.acknowledgedBy).toBe('operator-integration-001')

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )

    it.effect('rejects double-acknowledge (ISA-18.2 graph validation)', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-003')
        yield* setupTestSensor('TEST-SENSOR-003', 'TEST-MCH-ALM-003')

        const actor = yield* bootAlarmActor

        const alarm = yield* actor.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-003' }),
          })
        )

        // First acknowledge succeeds
        yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-001',
          })
        )

        // Second acknowledge fails (invalid transition: acknowledged -> acknowledged)
        const result = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-002',
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 3. CLEAR lifecycle — full ISA-18.2 lifecycle with events
  // ---------------------------------------------------------------------------
  describe('CLEAR lifecycle (full ISA-18.2)', () => {
    it.effect('completes full lifecycle: create -> acknowledge -> clear', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-004')
        yield* setupTestSensor('TEST-SENSOR-004', 'TEST-MCH-ALM-004')

        const actor = yield* bootAlarmActor

        // Step 1: CREATE
        const alarm = yield* actor.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-004' }),
          })
        )
        expect(alarm.state).toBe('unacknowledged')

        // Step 2: ACKNOWLEDGE
        const acknowledged = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-lifecycle',
          })
        )
        expect(acknowledged.state).toBe('acknowledged')
        expect(acknowledged.acknowledgedBy).toBe('operator-lifecycle')
        expect(acknowledged.acknowledgedAt).toBeDefined()

        // Step 3: CLEAR
        const cleared = yield* actor.send(
          new InternalClearAlarm({ alarmId: alarm.id })
        )
        expect(cleared.state).toBe('cleared')
        expect(cleared.clearedAt).toBeDefined()

        // Verify final persisted state via GET
        const final = yield* actor.send(
          new InternalGetAlarm({ alarmId: alarm.id })
        )
        expect(final.state).toBe('cleared')
        expect(final.acknowledgedBy).toBe('operator-lifecycle')
        expect(final.acknowledgedAt).toBeDefined()
        expect(final.clearedAt).toBeDefined()

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )

    it.effect('rejects clear on unacknowledged alarm (ISA-18.2 graph)', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-005')
        yield* setupTestSensor('TEST-SENSOR-005', 'TEST-MCH-ALM-005')

        const actor = yield* bootAlarmActor

        const alarm = yield* actor.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-005' }),
          })
        )

        // Try to clear without acknowledging (violates ISA-18.2)
        const result = yield* actor.send(
          new InternalClearAlarm({ alarmId: alarm.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )

    it.effect('rejects double-clear on already cleared alarm', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-006')
        yield* setupTestSensor('TEST-SENSOR-006', 'TEST-MCH-ALM-006')

        const actor = yield* bootAlarmActor

        const alarm = yield* actor.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-006' }),
          })
        )

        // Full lifecycle: acknowledge then clear
        yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-001',
          })
        )
        yield* actor.send(
          new InternalClearAlarm({ alarmId: alarm.id })
        )

        // Second clear fails (cleared -> cleared is invalid)
        const result = yield* actor.send(
          new InternalClearAlarm({ alarmId: alarm.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 4. Multi-actor scenario — 2 actors for different alarms, concurrent ops
  // ---------------------------------------------------------------------------
  describe('Multi-actor scenario', () => {
    it.effect('two actors manage independent alarms concurrently', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-MULTI-A')
        yield* setupTestMachine('TEST-MCH-ALM-MULTI-B')
        yield* setupTestSensor('TEST-SENSOR-MULTI-A', 'TEST-MCH-ALM-MULTI-A')
        yield* setupTestSensor('TEST-SENSOR-MULTI-B', 'TEST-MCH-ALM-MULTI-B')

        // Boot two independent actors
        const actorA = yield* bootAlarmActor
        const actorB = yield* bootAlarmActor

        // Create alarms on different actors
        const alarmA = yield* actorA.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({
              deviceId: 'TEST-SENSOR-MULTI-A',
              severity: 'critical',
              message: 'Actor A alarm',
            }),
          })
        )

        const alarmB = yield* actorB.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({
              deviceId: 'TEST-SENSOR-MULTI-B',
              severity: 'warning',
              message: 'Actor B alarm',
            }),
          })
        )

        // Verify independent creation
        expect(alarmA.id).not.toBe(alarmB.id)
        expect(alarmA.deviceId).toBe('TEST-SENSOR-MULTI-A')
        expect(alarmB.deviceId).toBe('TEST-SENSOR-MULTI-B')

        // Acknowledge A while B remains unacknowledged
        const ackA = yield* actorA.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarmA.id,
            acknowledgedBy: 'operator-A',
          })
        )
        expect(ackA.state).toBe('acknowledged')

        // Verify B is still unacknowledged (isolation)
        const fetchedB = yield* actorB.send(
          new InternalGetAlarm({ alarmId: alarmB.id })
        )
        expect(fetchedB.state).toBe('unacknowledged')

        // Now acknowledge B and clear A concurrently
        const ackB = yield* actorB.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarmB.id,
            acknowledgedBy: 'operator-B',
          })
        )
        expect(ackB.state).toBe('acknowledged')

        const clearA = yield* actorA.send(
          new InternalClearAlarm({ alarmId: alarmA.id })
        )
        expect(clearA.state).toBe('cleared')

        // Final state verification via round-trip GET
        const finalA = yield* actorA.send(
          new InternalGetAlarm({ alarmId: alarmA.id })
        )
        const finalB = yield* actorB.send(
          new InternalGetAlarm({ alarmId: alarmB.id })
        )

        expect(finalA.state).toBe('cleared')
        expect(finalB.state).toBe('acknowledged')
        expect(finalA.acknowledgedBy).toBe('operator-A')
        expect(finalB.acknowledgedBy).toBe('operator-B')

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )

    it.effect('actor A cannot affect actor B alarm state (isolation)', () =>
      Effect.gen(function* () {
        yield* cleanMachineTestData
        yield* setupMachineTestHierarchy
        yield* setupTestMachine('TEST-MCH-ALM-ISO-A')
        yield* setupTestMachine('TEST-MCH-ALM-ISO-B')
        yield* setupTestSensor('TEST-SENSOR-ISO-A', 'TEST-MCH-ALM-ISO-A')
        yield* setupTestSensor('TEST-SENSOR-ISO-B', 'TEST-MCH-ALM-ISO-B')

        const actorA = yield* bootAlarmActor
        const actorB = yield* bootAlarmActor

        // Create alarm via actor A
        const alarmA = yield* actorA.send(
          new InternalCreateAlarm({
            params: createTestAlarmParams({ deviceId: 'TEST-SENSOR-ISO-A' }),
          })
        )

        // Actor B can read alarm A (shared SQL state)
        const readByB = yield* actorB.send(
          new InternalGetAlarm({ alarmId: alarmA.id })
        )
        expect(readByB.id).toBe(alarmA.id)
        expect(readByB.state).toBe('unacknowledged')

        // Actor B acknowledges alarm A (cross-actor operation on shared state)
        const ackByB = yield* actorB.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarmA.id,
            acknowledgedBy: 'operator-B-cross',
          })
        )
        expect(ackByB.state).toBe('acknowledged')
        expect(ackByB.acknowledgedBy).toBe('operator-B-cross')

        // Actor A sees the updated state
        const readByA = yield* actorA.send(
          new InternalGetAlarm({ alarmId: alarmA.id })
        )
        expect(readByA.state).toBe('acknowledged')
        expect(readByA.acknowledgedBy).toBe('operator-B-cross')

        yield* cleanMachineTestData
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmMachineIntegrationLayer)
      )
    )
  })
})
