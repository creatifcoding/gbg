/**
 * Alarm Temporal Queries - Unit Tests
 *
 * Tests for temporal alarm state reconstruction from EventLog.
 *
 * @see ISA-18.2 for alarm management audit trail requirements
 * @see ADR-0012 for EventLog boundaries
 */

import { describe, it, expect } from 'vitest'
import { Effect, DateTime, Option, Layer, Duration, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  getAlarmAtTime,
  getAlarmHistory,
  foldAlarmEvents,
  AlarmTemporalError,
} from '../alarm-temporal'
import { AlarmEvents } from '../../../schemas/events/groups'
import type { AlarmId, DeviceId, AssetId, EventId } from '../../../schemas/identifiers'
import type { AlarmState, AlarmSeverity, AlarmType } from '../../../schemas/alarms'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockAlarmId = 'ALM-test-001' as AlarmId
const mockDeviceId = 'DEV-test-001' as DeviceId
const mockAssetId = 'AST-test-001' as AssetId

const makeEventId = (): EventId => `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

/**
 * Create AlarmTriggered payload matching EventGroup schema
 */
const makeAlarmTriggeredPayload = (overrides?: Partial<{
  alarmId: AlarmId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'test-sensor',
  entityId: mockAssetId,
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? mockAlarmId,
  deviceId: mockDeviceId,
  severity: 'critical' as AlarmSeverity,
  alarmType: 'high_temperature' as AlarmType,
  triggerValue: 85.5,
  thresholdValue: Option.some(80.0),
  unit: Option.some('celsius'),
  message: Option.some('Temperature exceeded threshold'),
  metadata: Option.none(),
})

const makeAlarmAcknowledgedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-1',
  entityId: mockAssetId,
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? mockAlarmId,
  deviceId: mockDeviceId,
  acknowledgedBy: 'operator-1',
  comments: Option.some('Acknowledged for investigation'),
})

const makeAlarmClearedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'auto-clear',
  entityId: mockAssetId,
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? mockAlarmId,
  deviceId: mockDeviceId,
  clearValue: Option.some(75.0),
  autoClear: false,
  notes: Option.some('Condition resolved'),
})

const makeAlarmShelvedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-2',
  entityId: mockAssetId,
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? mockAlarmId,
  deviceId: mockDeviceId,
  shelvedBy: 'operator-2',
  shelvedUntil: DateTime.add(DateTime.unsafeNow(), Duration.hours(4)),
  reason: Option.some('Investigating root cause'),
})

// =============================================================================
// Test Layer Setup
// =============================================================================

/**
 * Create a fresh memory journal for each test.
 * Using Layer.fresh ensures isolation between tests.
 */
const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)

/**
 * Helper to write an event directly to the journal.
 */
const writeEventToJournal = <Tag extends keyof typeof AlarmEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string,
  msecs?: number
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
// Feature: Temporal Alarm State Reconstruction
// =============================================================================

describe('Feature: Temporal Alarm State Reconstruction', () => {
  describe('Scenario: Get alarm state at a specific time', () => {
    it('Given alarm events, When querying at trigger time, Then state should be unacknowledged', async () => {
      const program = Effect.gen(function* () {
        const triggerTime = DateTime.unsafeNow()
        const payload = makeAlarmTriggeredPayload({ occurredAt: triggerTime })

        // Write event directly to journal
        yield* writeEventToJournal('AlarmTriggered', payload, mockAlarmId)

        // Query at trigger time (plus a small offset to ensure we're after the event)
        const queryTime = DateTime.add(triggerTime, Duration.millis(100))
        const result = yield* getAlarmAtTime(mockAlarmId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result._tag).toBe('AlarmAtTime')
      expect(result.alarm.state).toBe('unacknowledged')
      expect(result.fromReplay).toBe(true)
    })

    it('Given alarm acknowledged later, When querying before ack, Then state should be unacknowledged', async () => {
      // Use unique alarmId to avoid cross-test interference
      const testAlarmId = 'ALM-query-before-ack' as AlarmId

      const program = Effect.gen(function* () {
        // Use explicit timestamps to ensure proper ordering
        const baseTime = Date.now()
        const triggerTime = DateTime.unsafeMake(baseTime)
        const queryTime = DateTime.unsafeMake(baseTime + 120000) // +2 minutes
        const ackTime = DateTime.unsafeMake(baseTime + 300000) // +5 minutes

        // Write events
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: testAlarmId, occurredAt: triggerTime }),
          testAlarmId
        )
        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId: testAlarmId, occurredAt: ackTime }),
          testAlarmId
        )

        // Query between trigger and ack - should only see trigger event
        const result = yield* getAlarmAtTime(testAlarmId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.alarm.state).toBe('unacknowledged')
    })

    it('Given alarm acknowledged, When querying after ack, Then state should be acknowledged', async () => {
      const testAlarmId = 'ALM-query-after-ack' as AlarmId

      const program = Effect.gen(function* () {
        const triggerTime = DateTime.unsafeNow()
        const ackTime = DateTime.add(triggerTime, Duration.minutes(5))
        const queryTime = DateTime.add(ackTime, Duration.minutes(1))

        // Write events
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: testAlarmId, occurredAt: triggerTime }),
          testAlarmId
        )
        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId: testAlarmId, occurredAt: ackTime }),
          testAlarmId
        )

        // Query after ack
        const result = yield* getAlarmAtTime(testAlarmId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.alarm.state).toBe('acknowledged')
      expect(result.alarm.acknowledgedBy).toBe('operator-1')
    })

    it('Given no events for alarm, When querying, Then should return AlarmTemporalError', async () => {
      const program = Effect.gen(function* () {
        // Query for non-existent alarm
        const unknownAlarmId = 'ALM-nonexistent' as AlarmId
        const result = yield* getAlarmAtTime(unknownAlarmId, DateTime.unsafeNow())
        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await expect(Effect.runPromise(program)).rejects.toThrow()
    })
  })

  describe('Scenario: Get full alarm history', () => {
    it('Given multiple state transitions, When getting history, Then should return all transitions', async () => {
      const testAlarmId = 'ALM-history-multi' as AlarmId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        // Write event sequence: trigger -> ack -> clear
        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: testAlarmId, occurredAt: t0 }),
          testAlarmId
        )
        yield* writeEventToJournal(
          'AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId: testAlarmId, occurredAt: t1 }),
          testAlarmId
        )
        yield* writeEventToJournal(
          'AlarmCleared',
          makeAlarmClearedPayload({ alarmId: testAlarmId, occurredAt: t2 }),
          testAlarmId
        )

        const history = yield* getAlarmHistory(testAlarmId)

        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.length).toBe(3)

      // First transition: initial -> unacknowledged
      expect(result[0].toState).toBe('unacknowledged')

      // Second transition: unacknowledged -> acknowledged
      expect(result[1].fromState).toBe('unacknowledged')
      expect(result[1].toState).toBe('acknowledged')

      // Third transition: acknowledged -> cleared
      expect(result[2].fromState).toBe('acknowledged')
      expect(result[2].toState).toBe('cleared')
    })

    it('Given alarm with shelve/unshelve cycle, When getting history, Then should include all states', async () => {
      const testAlarmId = 'ALM-shelve-test' as AlarmId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(2))

        yield* writeEventToJournal(
          'AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: testAlarmId, occurredAt: t0 }),
          testAlarmId
        )
        yield* writeEventToJournal(
          'AlarmShelved',
          makeAlarmShelvedPayload({ alarmId: testAlarmId, occurredAt: t1 }),
          testAlarmId
        )

        const history = yield* getAlarmHistory(testAlarmId)

        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.length).toBe(2)
      expect(result[1].toState).toBe('shelved')
    })

    it('Given no events for alarm, When getting history, Then should return empty array', async () => {
      const program = Effect.gen(function* () {
        const unknownAlarmId = 'ALM-no-history' as AlarmId
        const history = yield* getAlarmHistory(unknownAlarmId)
        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })
  })

  describe('Scenario: Fold alarm events to state', () => {
    it('Given AlarmTriggered only, When folding, Then should produce unacknowledged alarm', () => {
      const events = [
        { _tag: 'AlarmTriggered' as const, ...makeAlarmTriggeredPayload() },
      ]

      const alarm = foldAlarmEvents(events, mockAlarmId)

      expect(alarm.state).toBe('unacknowledged')
      expect(alarm.id).toBe(mockAlarmId)
      expect(alarm.severity).toBe('critical')
    })

    it('Given trigger + ack events, When folding, Then should produce acknowledged alarm', () => {
      const triggerTime = DateTime.unsafeNow()
      const ackTime = DateTime.add(triggerTime, Duration.minutes(5))

      const events = [
        { _tag: 'AlarmTriggered' as const, ...makeAlarmTriggeredPayload({ occurredAt: triggerTime }) },
        { _tag: 'AlarmAcknowledged' as const, ...makeAlarmAcknowledgedPayload({ occurredAt: ackTime }) },
      ]

      const alarm = foldAlarmEvents(events, mockAlarmId)

      expect(alarm.state).toBe('acknowledged')
      expect(alarm.acknowledgedBy).toBe('operator-1')
    })

    it('Given full lifecycle, When folding, Then should produce cleared alarm', () => {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))
      const t2 = DateTime.add(t0, Duration.minutes(10))

      const events = [
        { _tag: 'AlarmTriggered' as const, ...makeAlarmTriggeredPayload({ occurredAt: t0 }) },
        { _tag: 'AlarmAcknowledged' as const, ...makeAlarmAcknowledgedPayload({ occurredAt: t1 }) },
        { _tag: 'AlarmCleared' as const, ...makeAlarmClearedPayload({ occurredAt: t2 }) },
      ]

      const alarm = foldAlarmEvents(events, mockAlarmId)

      expect(alarm.state).toBe('cleared')
      expect(alarm.clearedAt).toBeDefined()
    })

    it('Given empty events, When folding, Then should throw', () => {
      expect(() => foldAlarmEvents([], mockAlarmId)).toThrow()
    })
  })
})
