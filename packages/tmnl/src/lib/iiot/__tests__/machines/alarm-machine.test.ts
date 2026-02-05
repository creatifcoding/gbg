/**
 * AlarmMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-18.2 state transitions are enforced.
 *
 * @module
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
} from '../../machines/AlarmMachine'
import { AlarmStateInMemory, AlarmState } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateAlarmParams } from '../../schemas/alarms'
import type { DeviceId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestAlarmParams = (overrides?: Partial<{
  deviceId: string
  alarmType: string
  severity: string
  message: string
}>): CreateAlarmParams => ({
  deviceId: (overrides?.deviceId ?? 'device-001') as DeviceId,
  alarmType: (overrides?.alarmType ?? 'high_temperature') as CreateAlarmParams['alarmType'],
  severity: (overrides?.severity ?? 'critical') as CreateAlarmParams['severity'],
  message: overrides?.message ?? 'Test alarm',
})

// =============================================================================
// Tests
// =============================================================================

describe('AlarmMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates an alarm and returns it', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const alarm = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        expect(alarm.deviceId).toBe('device-001')
        expect(alarm.alarmType).toBe('high_temperature')
        expect(alarm.severity).toBe('critical')
        expect(alarm.state).toBe('unacknowledged')
        expect(alarm.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetAlarm({ alarmId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.deviceId).toBe(created.deviceId)
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineAlarmNotFoundError for non-existent alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetAlarm({ alarmId: 'non-existent-id' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineAlarmNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ACKNOWLEDGE procedure (graph-validated)', () => {
    it.effect('acknowledges an unacknowledged alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        const acknowledged = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: created.id,
            acknowledgedBy: 'operator-001',
          })
        )

        expect(acknowledged.state).toBe('acknowledged')
        expect(acknowledged.acknowledgedBy).toBe('operator-001')
        expect(acknowledged.acknowledgedAt).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineInvalidTransitionError when acknowledging already acknowledged alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        // First acknowledge succeeds
        yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: created.id,
            acknowledgedBy: 'operator-001',
          })
        )

        // Second acknowledge fails (invalid transition)
        const result = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: created.id,
            acknowledgedBy: 'operator-002',
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLEAR procedure (graph-validated)', () => {
    it.effect('clears an acknowledged alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: created.id,
            acknowledgedBy: 'operator-001',
          })
        )

        const cleared = yield* actor.send(
          new InternalClearAlarm({ alarmId: created.id })
        )

        expect(cleared.state).toBe('cleared')
        expect(cleared.clearedAt).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineInvalidTransitionError when clearing unacknowledged alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        // Try to clear without acknowledging first
        const result = yield* actor.send(
          new InternalClearAlarm({ alarmId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineInvalidTransitionError when clearing already cleared alarm', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )

        yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: created.id,
            acknowledgedBy: 'operator-001',
          })
        )

        // First clear succeeds
        yield* actor.send(
          new InternalClearAlarm({ alarmId: created.id })
        )

        // Second clear fails
        const result = yield* actor.send(
          new InternalClearAlarm({ alarmId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-18.2 lifecycle flow', () => {
    it.effect('completes full lifecycle: create → acknowledge → clear', () =>
      Effect.gen(function* () {
        const state = yield* AlarmState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAlarmMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create
        const alarm = yield* actor.send(
          new InternalCreateAlarm({ params: createTestAlarmParams() })
        )
        expect(alarm.state).toBe('unacknowledged')

        // Acknowledge
        const acknowledged = yield* actor.send(
          new InternalAcknowledgeAlarm({
            alarmId: alarm.id,
            acknowledgedBy: 'operator-001',
          })
        )
        expect(acknowledged.state).toBe('acknowledged')

        // Clear
        const cleared = yield* actor.send(
          new InternalClearAlarm({ alarmId: alarm.id })
        )
        expect(cleared.state).toBe('cleared')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetAlarm({ alarmId: alarm.id })
        )
        expect(final.state).toBe('cleared')
        expect(final.acknowledgedBy).toBe('operator-001')
        expect(final.acknowledgedAt).toBeDefined()
        expect(final.clearedAt).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(AlarmStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
