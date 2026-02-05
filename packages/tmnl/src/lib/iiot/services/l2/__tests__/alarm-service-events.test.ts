/**
 * AlarmService Event Emission Tests
 *
 * Unit tests for EventLog integration in AlarmService.
 * Feature flag: ES_ALARM_ENABLED controls event emission.
 *
 * Tests the emitAlarmEvent helper function which:
 * - Checks feature flag
 * - Creates EventLog client
 * - Emits event with proper payload
 *
 * @module
 * @see WBS EL-2.14-17 for alarm event emission requirements
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, DateTime, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import * as EventLog from '@effect/experimental/EventLog'
import {
  emitAlarmTriggered,
  emitAlarmAcknowledged,
  emitAlarmCleared,
} from '../alarm-event-emitter'
import {
  makeFeatureFlagsLayer,
} from '../../../infrastructure/feature-flags'
import {
  IIoTIdentityLayer,
} from '../../../infrastructure/eventlog-layer'
import { AlarmEvents } from '../../../schemas/events/groups'
import type { DeviceId, AlarmId } from '../../../schemas/identifiers'
import type { AlarmSeverity, AlarmType } from '../../../schemas/alarms'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockDeviceId = 'DEV-test-evt-001' as DeviceId
const mockAlarmId = 'ALM-test-evt-001' as AlarmId

// =============================================================================
// Test-Specific EventLog Schema (Alarms Only)
// =============================================================================

/**
 * Test-specific EventLog schema with ONLY AlarmEvents.
 * This avoids requiring handlers for StructuralEvents and OperationalEvents.
 */
const TestAlarmEventLogSchema = EventLog.schema(AlarmEvents)

// =============================================================================
// Test Layers
// =============================================================================

/**
 * Feature flags layer with alarm event sourcing ENABLED.
 */
const AlarmESEnabledLayer = makeFeatureFlagsLayer({
  alarmEventSourcingEnabled: true,
})

/**
 * Feature flags layer with alarm event sourcing DISABLED.
 */
const AlarmESDisabledLayer = makeFeatureFlagsLayer({
  alarmEventSourcingEnabled: false,
})

/**
 * No-op handlers for testing event emission.
 */
const NoOpAlarmHandlers = EventLog.group(AlarmEvents, (handlers) =>
  handlers
    .handle('AlarmTriggered', () => Effect.void)
    .handle('AlarmAcknowledged', () => Effect.void)
    .handle('AlarmCleared', () => Effect.void)
    .handle('AlarmEscalated', () => Effect.void)
    .handle('AlarmShelved', () => Effect.void)
    .handle('AlarmUnshelved', () => Effect.void)
    .handle('AlarmSuppressed', () => Effect.void)
    .handle('AlarmOutOfService', () => Effect.void)
    .handle('AlarmReturnedToService', () => Effect.void)
    .handle('AlarmConfigChanged', () => Effect.void)
)

/**
 * Test-specific EventLog layer using ONLY AlarmEvents.
 *
 * EventLog.layer REQUIRES EventHandler services (from EventLog.group).
 * Composition order:
 * 1. Handlers (NoOpAlarmHandlers) provide EventHandler<...>
 * 2. EventLog.layer consumes handlers + Journal + Identity
 */
const TestAlarmEventLogLayer = EventLog.layer(TestAlarmEventLogSchema).pipe(
  Layer.provide(NoOpAlarmHandlers),
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(IIoTIdentityLayer)
)

/**
 * Complete test layer exposing EventLog + EventJournal for tests.
 */
const TestEventLogStack = Layer.mergeAll(
  TestAlarmEventLogLayer,
  EventJournal.layerMemory
)

/**
 * Full test layer with ES_ALARM_ENABLED=true
 */
const TestLayerEnabled = Layer.merge(
  AlarmESEnabledLayer,
  TestEventLogStack
)

/**
 * Full test layer with ES_ALARM_ENABLED=false
 */
const TestLayerDisabled = Layer.merge(
  AlarmESDisabledLayer,
  TestEventLogStack
)

// =============================================================================
// Helper: Count Events in Journal
// =============================================================================

/**
 * Count events in the EventJournal for a specific event type.
 */
const countEventsInJournal = (
  eventTag: keyof typeof AlarmEvents.events
): Effect.Effect<number, never, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const entries = yield* journal.entries.pipe(Effect.orElseSucceed(() => [] as EventJournal.Entry[]))
    return entries.filter((e) => e.event === eventTag).length
  })

/**
 * Get the last event payload from the journal for a specific event type.
 */
const getLastEventPayload = <T extends keyof typeof AlarmEvents.events>(
  eventTag: T
): Effect.Effect<Record<string, unknown> | null, never, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const entries = yield* journal.entries.pipe(Effect.orElseSucceed(() => [] as EventJournal.Entry[]))
    const matching = entries.filter((e) => e.event === eventTag)

    if (matching.length === 0) return null

    const lastEntry = matching[matching.length - 1]
    const event = AlarmEvents.events[eventTag] as {
      payloadMsgPack: Schema.Schema<unknown, Uint8Array>
    }

    const decoded = yield* Schema.decode(
      event.payloadMsgPack as Schema.Schema<Record<string, unknown>, Uint8Array>
    )(lastEntry.payload).pipe(Effect.orElseSucceed(() => null as Record<string, unknown> | null))

    return decoded
  })

// =============================================================================
// Feature: Alarm Event Emission (EL-2.14-17)
// =============================================================================

describe('Feature: AlarmService Event Emission (EL-2.14-17)', () => {
  describe('Scenario: emitAlarmTriggered helper', () => {
    it('Given ES_ALARM_ENABLED=true, When emitAlarmTriggered is called, Then AlarmTriggered event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmTriggered')

        yield* emitAlarmTriggered({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          alarmType: 'high_temperature' as AlarmType,
          severity: 'critical' as AlarmSeverity,
          triggeredAt: DateTime.unsafeNow(),
          message: 'Test alarm for event emission',
        })

        const finalCount = yield* countEventsInJournal('AlarmTriggered')
        expect(finalCount).toBe(initialCount + 1)

        const payload = yield* getLastEventPayload('AlarmTriggered')
        expect(payload).not.toBeNull()
        expect(payload?.['alarmId']).toBe(mockAlarmId)
        expect(payload?.['deviceId']).toBe(mockDeviceId)
        expect(payload?.['severity']).toBe('critical')
        expect(payload?.['alarmType']).toBe('high_temperature')
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerEnabled)))
    })

    it('Given ES_ALARM_ENABLED=false, When emitAlarmTriggered is called, Then NO AlarmTriggered event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmTriggered')

        yield* emitAlarmTriggered({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          alarmType: 'high_temperature' as AlarmType,
          severity: 'warning' as AlarmSeverity,
          triggeredAt: DateTime.unsafeNow(),
          message: 'Test alarm without event emission',
        })

        const finalCount = yield* countEventsInJournal('AlarmTriggered')
        expect(finalCount).toBe(initialCount)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerDisabled)))
    })
  })

  describe('Scenario: emitAlarmAcknowledged helper', () => {
    it('Given ES_ALARM_ENABLED=true, When emitAlarmAcknowledged is called, Then AlarmAcknowledged event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmAcknowledged')

        yield* emitAlarmAcknowledged({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          acknowledgedBy: 'test-operator',
          acknowledgedAt: DateTime.unsafeNow(),
        })

        const finalCount = yield* countEventsInJournal('AlarmAcknowledged')
        expect(finalCount).toBe(initialCount + 1)

        const payload = yield* getLastEventPayload('AlarmAcknowledged')
        expect(payload).not.toBeNull()
        expect(payload?.['alarmId']).toBe(mockAlarmId)
        expect(payload?.['acknowledgedBy']).toBe('test-operator')
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerEnabled)))
    })

    it('Given ES_ALARM_ENABLED=false, When emitAlarmAcknowledged is called, Then NO AlarmAcknowledged event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmAcknowledged')

        yield* emitAlarmAcknowledged({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          acknowledgedBy: 'test-operator',
          acknowledgedAt: DateTime.unsafeNow(),
        })

        const finalCount = yield* countEventsInJournal('AlarmAcknowledged')
        expect(finalCount).toBe(initialCount)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerDisabled)))
    })
  })

  describe('Scenario: emitAlarmCleared helper', () => {
    it('Given ES_ALARM_ENABLED=true, When emitAlarmCleared is called, Then AlarmCleared event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmCleared')

        yield* emitAlarmCleared({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          clearedAt: DateTime.unsafeNow(),
          autoClear: false,
        })

        const finalCount = yield* countEventsInJournal('AlarmCleared')
        expect(finalCount).toBe(initialCount + 1)

        const payload = yield* getLastEventPayload('AlarmCleared')
        expect(payload).not.toBeNull()
        expect(payload?.['alarmId']).toBe(mockAlarmId)
        expect(payload?.['deviceId']).toBe(mockDeviceId)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerEnabled)))
    })

    it('Given ES_ALARM_ENABLED=false, When emitAlarmCleared is called, Then NO AlarmCleared event should be emitted', async () => {
      const program = Effect.gen(function* () {
        const initialCount = yield* countEventsInJournal('AlarmCleared')

        yield* emitAlarmCleared({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          clearedAt: DateTime.unsafeNow(),
          autoClear: true,
        })

        const finalCount = yield* countEventsInJournal('AlarmCleared')
        expect(finalCount).toBe(initialCount)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerDisabled)))
    })
  })

  describe('Scenario: Event payload correctness', () => {
    it('Given a triggered alarm, Then the AlarmTriggered payload should include all required fields', async () => {
      const program = Effect.gen(function* () {
        yield* emitAlarmTriggered({
          alarmId: mockAlarmId,
          deviceId: mockDeviceId,
          alarmType: 'high_vibration' as AlarmType,
          severity: 'emergency' as AlarmSeverity,
          triggeredAt: DateTime.unsafeNow(),
          message: 'Vibration threshold exceeded',
          triggerValue: 150,
          thresholdValue: 100,
          unit: 'mm_s',
          metadata: { source: 'test' },
        })

        const payload = yield* getLastEventPayload('AlarmTriggered')

        expect(payload).not.toBeNull()
        expect(payload?.['eventId']).toBeDefined()
        expect(payload?.['occurredAt']).toBeDefined()
        expect(payload?.['causedBy']).toBeDefined()
        expect(payload?.['entityId']).toBeDefined()
        expect(payload?.['entityType']).toBeDefined()
        expect(payload?.['alarmId']).toBe(mockAlarmId)
        expect(payload?.['deviceId']).toBe(mockDeviceId)
        expect(payload?.['severity']).toBe('emergency')
        expect(payload?.['alarmType']).toBe('high_vibration')
        expect(payload?.['triggerValue']).toBe(150)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayerEnabled)))
    })
  })
})
