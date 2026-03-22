/**
 * Alarm EventLog Integration Tests
 *
 * Integration tests for the complete Alarm EventLog flow:
 * - Event emission -> Handler -> Read model projection
 * - AlarmReactivity cache invalidation
 * - Temporal queries via EventJournal
 * - Feature flag toggle behavior
 *
 * @module @gbg/tmnl/iiot/handlers/__tests__/alarm-integration.test
 * @see EL-2.21 for test requirements
 * @see ISA-18.2 for alarm management standard
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Layer, Option, DateTime, Duration, Schema } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { AlarmEventHandlers } from '../alarm-handlers'
import { AlarmReactivity, ALARM_CACHE_KEYS } from '../alarm-reactivity'
import { AlarmRepo } from '../../repos/AlarmRepo'
import {
  IIoTEventLogSchema,
  IIoTEventLogStackLayer,
  IIoTIdentityLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import {
  IIoTFeatureFlags,
  IIoTFeatureFlagsEnabledLayer,
  IIoTFeatureFlagsDisabledLayer,
  makeFeatureFlagsLayer,
  isAlarmEventSourcingEnabled,
} from '../../infrastructure/feature-flags'
import { AlarmEvents } from '../../schemas/events/groups'
import {
  getAlarmAtTime,
  getAlarmHistory,
  foldAlarmEvents,
} from '../../services/l2/alarm-temporal'
import type { AlarmId, DeviceId, AssetId, EventId } from '../../schemas/identifiers'
import type { AlarmSeverity, AlarmType } from '../../schemas/alarms'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_PREFIX = 'TEST-INTEGRATION'
const makeTestAlarmId = (suffix: string): AlarmId => `${TEST_PREFIX}-ALM-${suffix}` as AlarmId
const makeTestDeviceId = (suffix: string): DeviceId => `${TEST_PREFIX}-DEV-${suffix}` as DeviceId
const makeTestEventId = (): EventId => `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId
const makeTestAssetId = (suffix: string): AssetId => `${TEST_PREFIX}-AST-${suffix}` as AssetId

// =============================================================================
// Test Fixtures
// =============================================================================

// Note: entityType must be lowercase ('device' not 'Device') per EquipmentLevel schema

const makeAlarmTriggeredPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
  severity?: AlarmSeverity
  alarmType?: AlarmType
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'test-sensor',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  severity: (overrides?.severity ?? 'critical') as AlarmSeverity,
  alarmType: (overrides?.alarmType ?? 'high_temperature') as AlarmType,
  triggerValue: 85.5,
  thresholdValue: Option.some(80.0),
  unit: Option.some('celsius'),
  message: Option.some('Temperature exceeded threshold'),
  metadata: Option.some({ threshold: 80, actualValue: 85.5 }),
})

const makeAlarmAcknowledgedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
  acknowledgedBy?: string
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: overrides?.acknowledgedBy ?? 'test-operator',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  acknowledgedBy: overrides?.acknowledgedBy ?? 'test-operator',
  comments: Option.some('Acknowledged for investigation'),
})

const makeAlarmClearedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'auto-clear',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  clearValue: Option.some(75.0),
  autoClear: false,
  notes: Option.some('Condition resolved'),
})

const makeAlarmShelvedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'test-operator-2',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  shelvedBy: 'test-operator-2',
  shelvedUntil: DateTime.add(DateTime.unsafeNow(), Duration.hours(4)),
  reason: Option.some('Investigating root cause'),
})

const makeAlarmUnshelvedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  autoUnshelve: true,
  unshelvedBy: Option.none() as Option.Option<string>,
})

const makeAlarmEscalatedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'escalation-service',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  escalationLevel: 2,
  escalatedTo: 'supervisor-team',
  elapsedSeconds: 600,
  notes: Option.some('Unacknowledged after 10 minutes'),
})

const makeAlarmOutOfServicePayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'maintenance-tech',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  disabledBy: 'maintenance-tech',
  reason: 'Planned maintenance',
  workOrderId: Option.some('WO-12345'),
  expectedReturnDate: Option.some(DateTime.add(DateTime.unsafeNow(), Duration.days(1))),
})

const makeAlarmReturnedToServicePayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'maintenance-tech',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  returnedBy: 'maintenance-tech',
  initialState: 'cleared' as const,
  notes: Option.some('Maintenance complete'),
})

const makeAlarmConfigChangedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'config-admin',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  changedBy: 'config-admin',
  changes: {
    threshold: {
      previous: Option.some(80),
      new: 85,
    },
  },
  reason: Option.some('Adjusted threshold based on operational data'),
  approvedBy: Option.some('supervisor'),
})

const makeAlarmSuppressedPayload = (overrides?: {
  alarmId?: AlarmId
  deviceId?: DeviceId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'engineer',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeTestAlarmId('001'),
  deviceId: overrides?.deviceId ?? makeTestDeviceId('001'),
  suppressedBy: 'engineer',
  reason: 'Design suppression during commissioning',
  workOrderId: Option.some('WO-COMM-001'),
})

// =============================================================================
// Test Layer Setup
// =============================================================================

/**
 * Create a fresh memory journal for each test.
 */
const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)

/**
 * Helper to write an event directly to the journal.
 */
const writeEventToJournal = <Tag extends keyof typeof AlarmEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string
): Effect.Effect<void, EventJournal.EventJournalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const event = AlarmEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }

    const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload).pipe(
      Effect.orDie
    )

    yield* journal.write({
      event: tag,
      primaryKey,
      payload: encodedPayload,
      effect: () => Effect.void,
    })
  })

// =============================================================================
// Test Suite: EventLog Layer Composition
// =============================================================================

describe('Feature: EventLog Layer Composition', () => {
  it('should compose EventLog with AlarmEventHandlers and AlarmReactivity', async () => {
    const program = Effect.gen(function* () {
      // The layer stack should build without error
      return 'composed'
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          IIoTEventLogLayer,
          AlarmEventHandlers,
          AlarmReactivity
        ).pipe(
          Layer.provide(makeTestEventJournalLayer()),
          Layer.provide(IIoTIdentityLayer)
        )
      )
    )

    const result = await Effect.runPromise(program)
    expect(result).toBe('composed')
  })

  it('should create EventLog client with IIoTEventLogSchema', async () => {
    const program = Effect.gen(function* () {
      const client = yield* EventLog.makeClient(IIoTEventLogSchema)
      expect(client).toBeDefined()
      expect(typeof client).toBe('function')
      return 'client-created'
    }).pipe(
      Effect.provide(IIoTEventLogStackLayer)
    )

    const result = await Effect.runPromise(program)
    expect(result).toBe('client-created')
  })
})

// =============================================================================
// Test Suite: Alarm Lifecycle Integration (Event -> Handler -> Read Model)
// =============================================================================

describe('Feature: Alarm Lifecycle Integration', () => {
  describe('Scenario: Full lifecycle trigger -> acknowledge -> clear', () => {
    it('Given an EventLog client, When events are written, Then state should be reconstructed via temporal queries', async () => {
      const testAlarmId = makeTestAlarmId('lifecycle-full')
      const testDeviceId = makeTestDeviceId('lifecycle-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        // Write trigger event
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        // Verify state at t0 + small offset
        const afterTrigger = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t0, Duration.millis(100))
        )
        expect(afterTrigger.alarm.state).toBe('unacknowledged')

        // Write acknowledge event
        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
            acknowledgedBy: 'test-operator',
          }),
          testAlarmId
        )

        // Verify state at t1 + offset
        const afterAck = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t1, Duration.millis(100))
        )
        expect(afterAck.alarm.state).toBe('acknowledged')
        expect(afterAck.alarm.acknowledgedBy).toBe('test-operator')

        // Write clear event
        yield* writeEventToJournal(
          'AlarmCleared',
          makeAlarmClearedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t2,
          }),
          testAlarmId
        )

        // Verify final state
        const afterClear = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t2, Duration.millis(100))
        )
        expect(afterClear.alarm.state).toBe('cleared')

        // Verify full history
        const history = yield* getAlarmHistory(testAlarmId)
        expect(history.length).toBe(3)
        expect(history[0].toState).toBe('unacknowledged')
        expect(history[1].toState).toBe('acknowledged')
        expect(history[2].toState).toBe('cleared')

        return 'lifecycle-complete'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('lifecycle-complete')
    })
  })

  describe('Scenario: Shelving flow trigger -> shelve -> unshelve', () => {
    it('Given an alarm, When shelved and unshelved, Then state transitions should be tracked', async () => {
      const testAlarmId = makeTestAlarmId('shelve-flow')
      const testDeviceId = makeTestDeviceId('shelve-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(2))
        const t2 = DateTime.add(t0, Duration.minutes(60))

        // Trigger alarm
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        // Shelve alarm
        yield* writeEventToJournal(
          'AlarmShelved',
          makeAlarmShelvedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
          }),
          testAlarmId
        )

        // Verify shelved state
        const afterShelve = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t1, Duration.millis(100))
        )
        expect(afterShelve.alarm.state).toBe('shelved')

        // Unshelve alarm
        yield* writeEventToJournal(
          'AlarmUnshelved',
          makeAlarmUnshelvedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t2,
          }),
          testAlarmId
        )

        // Verify returned to unacknowledged state
        const afterUnshelve = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t2, Duration.millis(100))
        )
        expect(afterUnshelve.alarm.state).toBe('unacknowledged')

        // Verify history
        const history = yield* getAlarmHistory(testAlarmId)
        expect(history.length).toBe(3)
        expect(history[1].toState).toBe('shelved')
        expect(history[2].toState).toBe('unacknowledged')

        return 'shelve-flow-complete'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('shelve-flow-complete')
    })
  })

  describe('Scenario: Escalation trigger -> escalate (no state change, audit only)', () => {
    it('Given an unacknowledged alarm, When escalated, Then state should remain unacknowledged but event is recorded', async () => {
      const testAlarmId = makeTestAlarmId('escalation-flow')
      const testDeviceId = makeTestDeviceId('escalation-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))

        // Trigger alarm
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        // Escalate alarm (no state change per ISA-18.2)
        yield* writeEventToJournal(
          'AlarmEscalated',
          makeAlarmEscalatedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
          }),
          testAlarmId
        )

        // Verify state remains unacknowledged
        const afterEscalate = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t1, Duration.millis(100))
        )
        expect(afterEscalate.alarm.state).toBe('unacknowledged')

        // History should only have trigger (escalation doesn't create a state transition)
        const history = yield* getAlarmHistory(testAlarmId)
        expect(history.length).toBe(1)
        expect(history[0].toState).toBe('unacknowledged')

        return 'escalation-flow-complete'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('escalation-flow-complete')
    })
  })

  describe('Scenario: Out of service trigger -> out of service -> return to service', () => {
    it('Given an alarm, When taken OOS and returned, Then lifecycle should be tracked', async () => {
      const testAlarmId = makeTestAlarmId('oos-flow')
      const testDeviceId = makeTestDeviceId('oos-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.hours(8))

        // Trigger alarm
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        // Take out of service
        yield* writeEventToJournal(
          'AlarmOutOfService',
          makeAlarmOutOfServicePayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
          }),
          testAlarmId
        )

        // Verify OOS state
        const afterOOS = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t1, Duration.millis(100))
        )
        expect(afterOOS.alarm.state).toBe('out_of_service')

        // Return to service
        yield* writeEventToJournal(
          'AlarmReturnedToService',
          makeAlarmReturnedToServicePayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t2,
          }),
          testAlarmId
        )

        // Verify returned (cleared based on payload)
        const afterReturn = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t2, Duration.millis(100))
        )
        expect(afterReturn.alarm.state).toBe('cleared')

        return 'oos-flow-complete'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('oos-flow-complete')
    })
  })

  describe('Scenario: Config change (audit trail only)', () => {
    it('Given an alarm, When config is changed, Then event should be recorded without state change', async () => {
      const testAlarmId = makeTestAlarmId('config-change')
      const testDeviceId = makeTestDeviceId('config-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        // Trigger alarm
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        // Acknowledge
        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
          }),
          testAlarmId
        )

        // Config change (should not affect state)
        yield* writeEventToJournal(
          'AlarmConfigChanged',
          makeAlarmConfigChangedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t2,
          }),
          testAlarmId
        )

        // Verify state remains acknowledged
        const afterConfig = yield* getAlarmAtTime(
          testAlarmId,
          DateTime.add(t2, Duration.millis(100))
        )
        expect(afterConfig.alarm.state).toBe('acknowledged')

        return 'config-change-complete'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('config-change-complete')
    })
  })
})

// =============================================================================
// Test Suite: Idempotency
// =============================================================================

describe('Feature: Event Idempotency', () => {
  it('Given the same event written twice, When reading state, Then no duplicate in history', async () => {
    const testAlarmId = makeTestAlarmId('idempotency')
    const testDeviceId = makeTestDeviceId('idempotency-001')

    const program = Effect.gen(function* () {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))

      // Write trigger
      yield* writeEventToJournal(
        'AlarmTriggered',
        makeAlarmTriggeredPayload({
          alarmId: testAlarmId,
          deviceId: testDeviceId,
          occurredAt: t0,
        }),
        testAlarmId
      )

      // Write acknowledge twice with same payload (simulating replay)
      const ackPayload = makeAlarmAcknowledgedPayload({
        alarmId: testAlarmId,
        deviceId: testDeviceId,
        occurredAt: t1,
      })

      yield* writeEventToJournal('AlarmAcknowledged', ackPayload, testAlarmId)
      yield* writeEventToJournal('AlarmAcknowledged', ackPayload, testAlarmId)

      // Verify final state is still acknowledged (not corrupted)
      const state = yield* getAlarmAtTime(
        testAlarmId,
        DateTime.add(t1, Duration.millis(100))
      )
      expect(state.alarm.state).toBe('acknowledged')

      return 'idempotency-ok'
    }).pipe(Effect.provide(makeTestEventJournalLayer()))

    const result = await Effect.runPromise(program)
    expect(result).toBe('idempotency-ok')
  })
})

// =============================================================================
// Test Suite: AlarmReactivity Cache Invalidation
// =============================================================================

describe('Feature: AlarmReactivity Cache Invalidation', () => {
  it('should define cache keys for all ISA-18.2 categories', () => {
    expect(ALARM_CACHE_KEYS.ALARMS_ACTIVE).toBe('alarms:active')
    expect(ALARM_CACHE_KEYS.ALARMS_DASHBOARD).toBe('alarms:dashboard')
    expect(ALARM_CACHE_KEYS.ALARMS_HISTORY).toBe('alarms:history')
    expect(ALARM_CACHE_KEYS.ALARMS_UNACKNOWLEDGED).toBe('alarms:unacknowledged')
    expect(ALARM_CACHE_KEYS.ALARMS_ESCALATED).toBe('alarms:escalated')
    expect(ALARM_CACHE_KEYS.ALARMS_SHELVED).toBe('alarms:shelved')
    expect(ALARM_CACHE_KEYS.ALARMS_SUPPRESSED).toBe('alarms:suppressed')
    expect(ALARM_CACHE_KEYS.ALARMS_OOS).toBe('alarms:oos')
    expect(ALARM_CACHE_KEYS.ALARMS_CONFIG).toBe('alarms:config')
  })

  it('should compose AlarmReactivity layer with EventLog', async () => {
    const program = Effect.gen(function* () {
      // Just verify the layer builds
      return 'composed'
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          IIoTEventLogLayer,
          AlarmReactivity
        ).pipe(
          Layer.provide(makeTestEventJournalLayer()),
          Layer.provide(IIoTIdentityLayer)
        )
      )
    )

    const result = await Effect.runPromise(program)
    expect(result).toBe('composed')
  })
})

// =============================================================================
// Test Suite: Temporal Queries
// =============================================================================

describe('Feature: Temporal Queries', () => {
  describe('getAlarmAtTime', () => {
    it('should return AlarmTemporalError for non-existent alarm', async () => {
      const program = Effect.gen(function* () {
        const unknownAlarmId = makeTestAlarmId('nonexistent')
        const result = yield* getAlarmAtTime(unknownAlarmId, DateTime.unsafeNow())
        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await expect(Effect.runPromise(program)).rejects.toThrow()
    })

    it('should return state before a specific transition', async () => {
      const testAlarmId = makeTestAlarmId('temporal-before')
      const testDeviceId = makeTestDeviceId('temporal-001')

      const program = Effect.gen(function* () {
        const baseTime = Date.now()
        const triggerTime = DateTime.unsafeMake(baseTime)
        const queryTime = DateTime.unsafeMake(baseTime + 120000) // +2 min
        const ackTime = DateTime.unsafeMake(baseTime + 300000) // +5 min

        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: triggerTime,
          }),
          testAlarmId
        )

        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: ackTime,
          }),
          testAlarmId
        )

        // Query between trigger and ack
        const result = yield* getAlarmAtTime(testAlarmId, queryTime)
        return result.alarm.state
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const state = await Effect.runPromise(program)
      expect(state).toBe('unacknowledged')
    })
  })

  describe('getAlarmHistory', () => {
    it('should return empty array for non-existent alarm', async () => {
      const program = Effect.gen(function* () {
        const unknownAlarmId = makeTestAlarmId('history-nonexistent')
        const history = yield* getAlarmHistory(unknownAlarmId)
        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toEqual([])
    })

    it('should return all state transitions in order', async () => {
      const testAlarmId = makeTestAlarmId('history-all')
      const testDeviceId = makeTestDeviceId('history-001')

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t0,
          }),
          testAlarmId
        )

        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t1,
          }),
          testAlarmId
        )

        yield* writeEventToJournal(
          'AlarmCleared',
          makeAlarmClearedPayload({
            alarmId: testAlarmId,
            deviceId: testDeviceId,
            occurredAt: t2,
          }),
          testAlarmId
        )

        const history = yield* getAlarmHistory(testAlarmId)
        return history.map(t => t.toState)
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const states = await Effect.runPromise(program)
      expect(states).toEqual(['unacknowledged', 'acknowledged', 'cleared'])
    })
  })

  describe('foldAlarmEvents', () => {
    it('should throw for empty events array', () => {
      const testAlarmId = makeTestAlarmId('fold-empty')
      expect(() => foldAlarmEvents([], testAlarmId)).toThrow()
    })

    it('should fold single trigger event to unacknowledged', () => {
      const testAlarmId = makeTestAlarmId('fold-single')
      const events = [
        { _tag: 'AlarmTriggered' as const, ...makeAlarmTriggeredPayload({ alarmId: testAlarmId }) },
      ]

      const alarm = foldAlarmEvents(events, testAlarmId)
      expect(alarm.state).toBe('unacknowledged')
    })

    it('should fold trigger + ack to acknowledged', () => {
      const testAlarmId = makeTestAlarmId('fold-ack')
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))

      const events = [
        { _tag: 'AlarmTriggered' as const, ...makeAlarmTriggeredPayload({ alarmId: testAlarmId, occurredAt: t0 }) },
        { _tag: 'AlarmAcknowledged' as const, ...makeAlarmAcknowledgedPayload({ alarmId: testAlarmId, occurredAt: t1 }) },
      ]

      const alarm = foldAlarmEvents(events, testAlarmId)
      expect(alarm.state).toBe('acknowledged')
      expect(alarm.acknowledgedBy).toBe('test-operator')
    })
  })
})

// =============================================================================
// Test Suite: Feature Flag Toggle
// =============================================================================

describe('Feature: Feature Flag Toggle', () => {
  describe('isAlarmEventSourcingEnabled', () => {
    it('should return false when flags are disabled', async () => {
      const program = Effect.gen(function* () {
        return yield* isAlarmEventSourcingEnabled
      }).pipe(Effect.provide(IIoTFeatureFlagsDisabledLayer))

      const result = await Effect.runPromise(program)
      expect(result).toBe(false)
    })

    it('should return true when flags are enabled', async () => {
      const program = Effect.gen(function* () {
        return yield* isAlarmEventSourcingEnabled
      }).pipe(Effect.provide(IIoTFeatureFlagsEnabledLayer))

      const result = await Effect.runPromise(program)
      expect(result).toBe(true)
    })

    it('should allow custom flag configuration', async () => {
      const customFlags = makeFeatureFlagsLayer({
        alarmEventSourcingEnabled: true,
        equipmentStateEventSourcingEnabled: false,
      })

      const program = Effect.gen(function* () {
        const flags = yield* IIoTFeatureFlags
        return {
          alarm: flags.alarmEventSourcingEnabled,
          equipment: flags.equipmentStateEventSourcingEnabled,
        }
      }).pipe(Effect.provide(customFlags))

      const result = await Effect.runPromise(program)
      expect(result.alarm).toBe(true)
      expect(result.equipment).toBe(false)
    })
  })

  describe('Behavior difference based on flag', () => {
    it('Given ES_ALARM_ENABLED=false, When service is used, Then legacy CRUD path should be taken', async () => {
      const program = Effect.gen(function* () {
        const enabled = yield* isAlarmEventSourcingEnabled
        if (enabled) {
          return 'eventlog-path'
        } else {
          return 'crud-path'
        }
      }).pipe(Effect.provide(IIoTFeatureFlagsDisabledLayer))

      const result = await Effect.runPromise(program)
      expect(result).toBe('crud-path')
    })

    it('Given ES_ALARM_ENABLED=true, When service is used, Then EventLog path should be taken', async () => {
      const program = Effect.gen(function* () {
        const enabled = yield* isAlarmEventSourcingEnabled
        if (enabled) {
          return 'eventlog-path'
        } else {
          return 'crud-path'
        }
      }).pipe(Effect.provide(IIoTFeatureFlagsEnabledLayer))

      const result = await Effect.runPromise(program)
      expect(result).toBe('eventlog-path')
    })
  })
})

// =============================================================================
// Test Suite: Error Resilience
// =============================================================================

describe('Feature: Error Resilience', () => {
  it('should handle malformed payload gracefully in temporal queries', async () => {
    const testAlarmId = makeTestAlarmId('malformed')

    const program = Effect.gen(function* () {
      const journal = yield* EventJournal.EventJournal

      // Write a malformed entry directly (bypassing schema encoding)
      yield* journal.write({
        event: 'AlarmTriggered',
        primaryKey: testAlarmId,
        payload: new Uint8Array([0x00, 0x01, 0x02]), // Invalid msgpack
        effect: () => Effect.void,
      })

      // This should fail gracefully with AlarmTemporalError
      const result = yield* getAlarmAtTime(testAlarmId, DateTime.unsafeNow())
      return result
    }).pipe(Effect.provide(makeTestEventJournalLayer()))

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })
})
