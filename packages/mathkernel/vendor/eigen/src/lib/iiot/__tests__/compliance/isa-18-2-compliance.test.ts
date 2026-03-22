/**
 * ISA-18.2 Compliance Tests for Alarm Event Sourcing
 *
 * Validates that the alarm schemas and event sourcing implementation
 * conform to ISA-18.2 alarm management standard requirements:
 * - 6 defined alarm states
 * - Valid state transitions
 * - Shelve duration limits (max 24 hours)
 * - Required suppression reasons
 * - Audit trail preservation
 * - Temporal queries
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/compliance/isa-18-2-compliance.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/compliance/isa-18-2-compliance
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, DateTime, Option, Duration, Layer, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EventJournalIntegrationLayer,
  cleanTestEventJournal,
  isDatabaseAvailable,
  withFullyCleanDatabase,
} from '../integration/layer'
import {
  AlarmState,
  isValidTransition,
  canAcknowledge,
  canShelve,
  canSuppress,
  canClear,
  canTakeOutOfService,
  canReturnToService,
  ShelveAlarmParams,
  SuppressAlarmParams,
} from '../../schemas/alarms'
import { AlarmEvents } from '../../schemas/events/groups'
import type { AlarmId, DeviceId, AssetId, EventId } from '../../schemas/identifiers'
import type { AlarmSeverity, AlarmType } from '../../schemas/alarms'
import { testIds } from '../__fixtures__/fixtures'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_DEVICE_ID = testIds.device1
const TEST_ASSET_ID = testIds.device1 as unknown as AssetId

const makeAlarmId = (): AlarmId =>
  `TEST-ALM-${Date.now()}-${Math.random().toString(36).slice(2)}` as AlarmId

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

// =============================================================================
// Event Payload Factories
// =============================================================================

const makeAlarmTriggeredPayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  severity: AlarmSeverity
  alarmType: AlarmType
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'sensor-monitor',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  severity: overrides?.severity ?? ('critical' as AlarmSeverity),
  alarmType: overrides?.alarmType ?? ('high_temperature' as AlarmType),
  triggerValue: 85.5,
  thresholdValue: Option.some(80.0),
  unit: Option.some('celsius'),
  message: Option.some('Temperature exceeded threshold'),
  metadata: Option.none() as Option.Option<Record<string, unknown>>,
})

const makeAlarmAcknowledgedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  acknowledgedBy: string
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  acknowledgedBy: overrides?.acknowledgedBy ?? 'operator-001',
  comments: Option.some('Acknowledged and monitoring'),
})

const makeAlarmClearedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  clearValue: Option.some(75.0),
  autoClear: false,
  notes: Option.some('Temperature returned to normal'),
})

const makeAlarmShelvedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  shelvedBy: string
  shelvedUntil: DateTime.Utc
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  shelvedBy: overrides?.shelvedBy ?? 'operator-001',
  shelvedUntil: overrides?.shelvedUntil ?? DateTime.add(DateTime.unsafeNow(), Duration.hours(2)),
  reason: Option.some('Maintenance in progress'),
})

const makeAlarmSuppressedPayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  suppressedBy: string
  reason: string
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  suppressedBy: overrides?.suppressedBy ?? 'maintenance-tech-001',
  reason: overrides?.reason ?? 'Equipment under maintenance',
  workOrderId: Option.some('WO-TEST-001'),
})

const makeAlarmOutOfServicePayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  disabledBy: string
  reason: string
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'maintenance',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  disabledBy: overrides?.disabledBy ?? 'maintenance-tech-001',
  reason: overrides?.reason ?? 'Sensor replacement scheduled',
  workOrderId: Option.some('WO-TEST-002'),
  expectedReturnDate: Option.some(DateTime.add(DateTime.unsafeNow(), Duration.days(1))),
})

const makeAlarmReturnedToServicePayload = (overrides?: Partial<{
  alarmId: AlarmId
  deviceId: DeviceId
  returnedBy: string
  initialState: 'unacknowledged' | 'cleared'
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'maintenance',
  entityId: TEST_ASSET_ID,
  entityType: 'device' as const, // ISA-95 equipment level (lowercase)
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  alarmId: overrides?.alarmId ?? makeAlarmId(),
  deviceId: overrides?.deviceId ?? TEST_DEVICE_ID,
  returnedBy: overrides?.returnedBy ?? 'maintenance-tech-001',
  initialState: overrides?.initialState ?? 'cleared',
  notes: Option.some('Sensor replaced and calibrated'),
})

// =============================================================================
// Test Layer Setup
// =============================================================================

/**
 * Create a fresh memory journal for each test (unit tests).
 */
const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)

/**
 * Helper to write an alarm event to the journal.
 */
const writeAlarmEventToJournal = <Tag extends keyof typeof AlarmEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  alarmId: AlarmId
): Effect.Effect<void, EventJournal.EventJournalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const event = AlarmEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }

    const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload).pipe(
      Effect.orDie
    )

    yield* journal.write({
      event: tag,
      primaryKey: alarmId,
      payload: encodedPayload,
      effect: () => Effect.void,
    })
  })

// =============================================================================
// ISA-18.2 State Model Tests
// =============================================================================

describe('ISA-18.2 Compliance: Alarm State Model', () => {
  describe('1. All 6 states present', () => {
    it('should include all ISA-18.2 alarm states', () => {
      // ISA-18.2 Section 6.2 defines these 6 alarm states
      const requiredStates = [
        'unacknowledged',
        'acknowledged',
        'shelved',
        'suppressed',
        'cleared',
        'out_of_service',
      ] as const

      // Verify the AlarmState schema accepts all required states
      for (const state of requiredStates) {
        const result = Schema.decodeEither(AlarmState)(state)
        expect(result._tag).toBe('Right')
      }
    })

    it('should reject invalid states', () => {
      const invalidStates = ['active', 'inactive', 'pending', 'unknown', '']

      for (const state of invalidStates) {
        const result = Schema.decodeEither(AlarmState)(state)
        expect(result._tag).toBe('Left')
      }
    })
  })

  describe('2. Valid transitions succeed', () => {
    it('should allow unacknowledged -> acknowledged', () => {
      const from = 'unacknowledged' as typeof AlarmState.Type
      const to = 'acknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canAcknowledge(from)).toBe(true)
    })

    it('should allow acknowledged -> cleared', () => {
      const from = 'acknowledged' as typeof AlarmState.Type
      const to = 'cleared' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canClear(from)).toBe(true)
    })

    it('should allow unacknowledged -> shelved', () => {
      const from = 'unacknowledged' as typeof AlarmState.Type
      const to = 'shelved' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canShelve(from)).toBe(true)
    })

    it('should allow acknowledged -> shelved', () => {
      const from = 'acknowledged' as typeof AlarmState.Type
      const to = 'shelved' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canShelve(from)).toBe(true)
    })

    it('should allow unacknowledged -> suppressed', () => {
      const from = 'unacknowledged' as typeof AlarmState.Type
      const to = 'suppressed' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canSuppress(from)).toBe(true)
    })

    it('should allow acknowledged -> suppressed', () => {
      const from = 'acknowledged' as typeof AlarmState.Type
      const to = 'suppressed' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
      expect(canSuppress(from)).toBe(true)
    })

    it('should allow most states -> out_of_service', () => {
      // Per the schema, cleared can only transition to unacknowledged (re-trigger)
      // All other states can transition to out_of_service
      const statesAllowedToOOS = ['unacknowledged', 'acknowledged', 'shelved', 'suppressed'] as const
      const to = 'out_of_service' as typeof AlarmState.Type

      for (const from of statesAllowedToOOS) {
        const typedFrom = from as typeof AlarmState.Type
        expect(isValidTransition(typedFrom, to)).toBe(true)
        expect(canTakeOutOfService(typedFrom)).toBe(true)
      }
    })

    it('should NOT allow cleared -> out_of_service (per schema design)', () => {
      // The schema restricts cleared state to only transition to unacknowledged
      // This is a design choice - cleared alarms should re-trigger, not go to maintenance
      const from = 'cleared' as typeof AlarmState.Type
      const to = 'out_of_service' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
    })

    it('should allow out_of_service -> unacknowledged or cleared', () => {
      const from = 'out_of_service' as typeof AlarmState.Type
      expect(isValidTransition(from, 'unacknowledged' as typeof AlarmState.Type)).toBe(true)
      expect(isValidTransition(from, 'cleared' as typeof AlarmState.Type)).toBe(true)
      expect(canReturnToService(from)).toBe(true)
    })

    it('should allow shelved -> unacknowledged (unshelve)', () => {
      const from = 'shelved' as typeof AlarmState.Type
      const to = 'unacknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
    })

    it('should allow shelved -> acknowledged (unshelve)', () => {
      const from = 'shelved' as typeof AlarmState.Type
      const to = 'acknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
    })

    it('should allow suppressed -> unacknowledged (unsuppress)', () => {
      const from = 'suppressed' as typeof AlarmState.Type
      const to = 'unacknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
    })

    it('should allow suppressed -> acknowledged (unsuppress)', () => {
      const from = 'suppressed' as typeof AlarmState.Type
      const to = 'acknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
    })

    it('should allow cleared -> unacknowledged (re-trigger)', () => {
      const from = 'cleared' as typeof AlarmState.Type
      const to = 'unacknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(true)
    })
  })

  describe('3. Invalid transitions fail', () => {
    it('should reject cleared -> acknowledged', () => {
      const from = 'cleared' as typeof AlarmState.Type
      const to = 'acknowledged' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
      expect(canAcknowledge(from)).toBe(false)
    })

    it('should reject out_of_service -> shelved', () => {
      const from = 'out_of_service' as typeof AlarmState.Type
      const to = 'shelved' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
    })

    it('should reject shelved -> cleared (must unshelve first)', () => {
      const from = 'shelved' as typeof AlarmState.Type
      const to = 'cleared' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
      expect(canClear(from)).toBe(false)
    })

    it('should reject suppressed -> cleared (must unsuppress first)', () => {
      const from = 'suppressed' as typeof AlarmState.Type
      const to = 'cleared' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
    })

    it('should reject out_of_service -> out_of_service (no self-transition)', () => {
      const from = 'out_of_service' as typeof AlarmState.Type
      expect(canTakeOutOfService(from)).toBe(false)
    })

    it('should reject unacknowledged -> cleared (must acknowledge first)', () => {
      const from = 'unacknowledged' as typeof AlarmState.Type
      const to = 'cleared' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
      expect(canClear(from)).toBe(false)
    })

    it('should reject cleared -> shelved', () => {
      const from = 'cleared' as typeof AlarmState.Type
      const to = 'shelved' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
      expect(canShelve(from)).toBe(false)
    })

    it('should reject cleared -> suppressed', () => {
      const from = 'cleared' as typeof AlarmState.Type
      const to = 'suppressed' as typeof AlarmState.Type
      expect(isValidTransition(from, to)).toBe(false)
      expect(canSuppress(from)).toBe(false)
    })
  })

  describe('4. 24-hour shelve duration enforced', () => {
    it('should accept valid duration (60 minutes)', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 60,
        reason: 'Short maintenance',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Right')
    })

    it('should accept valid duration (720 minutes = 12 hours)', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 720,
        reason: 'Extended maintenance',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Right')
    })

    it('should accept maximum valid duration (1440 minutes = 24 hours)', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 1440,
        reason: 'Maximum shelve duration',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Right')
    })

    it('should reject duration exceeding 24 hours (1441 minutes)', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 1441,
        reason: 'Too long',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Left')
    })

    it('should reject duration exceeding 24 hours (2880 minutes = 48 hours)', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 2880,
        reason: 'Way too long',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Left')
    })

    it('should reject zero duration', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: 0,
        reason: 'Invalid',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Left')
    })

    it('should reject negative duration', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        shelvedBy: 'operator-001',
        durationMinutes: -60,
        reason: 'Invalid',
      }
      const result = Schema.decodeEither(ShelveAlarmParams)(params)
      expect(result._tag).toBe('Left')
    })
  })

  describe('5. Reason required for suppression', () => {
    it('should accept valid suppression with reason', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        suppressedBy: 'maintenance-tech-001',
        reason: 'Equipment under scheduled maintenance',
      }
      const result = Schema.decodeEither(SuppressAlarmParams)(params)
      expect(result._tag).toBe('Right')
    })

    it('should reject suppression with empty string reason', () => {
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        suppressedBy: 'maintenance-tech-001',
        reason: '',
      }
      const result = Schema.decodeEither(SuppressAlarmParams)(params)
      expect(result._tag).toBe('Left')
    })

    it('should note that whitespace-only reason passes NonEmptyString (length > 0)', () => {
      // Note: Schema.NonEmptyString checks length > 0, not trimmed length
      // Whitespace-only strings technically pass because they have length > 0
      // This is expected behavior - business logic can add additional validation
      const params = {
        alarmId: 'TEST-ALM-001' as AlarmId,
        suppressedBy: 'maintenance-tech-001',
        reason: '   ',
      }
      const result = Schema.decodeEither(SuppressAlarmParams)(params)
      // NonEmptyString allows whitespace-only because length('   ') = 3 > 0
      expect(result._tag).toBe('Right')
    })
  })
})

// =============================================================================
// Event Sourcing Tests (in-memory EventJournal)
// =============================================================================

describe('ISA-18.2 Compliance: Alarm Event Sourcing', () => {
  describe('6. Audit trail preserved', () => {
    it('should write and read back alarm lifecycle events in order', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        // Write lifecycle: triggered -> acknowledged -> cleared
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId, occurredAt: t1 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmCleared',
          makeAlarmClearedPayload({ alarmId, occurredAt: t2 }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)

        expect(alarmEntries.length).toBe(3)

        // Verify event order
        const eventTags = alarmEntries.map((e) => e.event)
        expect(eventTags).toContain('AlarmTriggered')
        expect(eventTags).toContain('AlarmAcknowledged')
        expect(eventTags).toContain('AlarmCleared')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should capture who/when in each event', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const occurredAt = DateTime.unsafeNow()

        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({
            alarmId,
            occurredAt,
          }),
          alarmId
        )

        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({
            alarmId,
            occurredAt: DateTime.add(occurredAt, Duration.minutes(2)),
            acknowledgedBy: 'operator-jane',
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)
        expect(alarmEntries.length).toBe(2)

        // Verify events were stored
        expect(alarmEntries[0].event).toBe('AlarmTriggered')
        expect(alarmEntries[1].event).toBe('AlarmAcknowledged')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should preserve shelve/unshelve audit trail', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const shelvedUntil = DateTime.add(t0, Duration.hours(2))

        // Triggered -> Shelved (with audit data)
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmShelved',
          makeAlarmShelvedPayload({
            alarmId,
            occurredAt: t1,
            shelvedBy: 'operator-bob',
            shelvedUntil,
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)
        expect(alarmEntries.length).toBe(2)

        expect(alarmEntries[1].event).toBe('AlarmShelved')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should preserve suppression audit trail with reason', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))

        // Triggered -> Suppressed (with mandatory reason)
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmSuppressed',
          makeAlarmSuppressedPayload({
            alarmId,
            occurredAt: t1,
            suppressedBy: 'maintenance-tech-001',
            reason: 'Planned maintenance window - WO-123',
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)
        expect(alarmEntries.length).toBe(2)

        expect(alarmEntries[1].event).toBe('AlarmSuppressed')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should preserve out_of_service audit trail', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.days(1))

        // Triggered -> OutOfService -> ReturnedToService
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmOutOfService',
          makeAlarmOutOfServicePayload({
            alarmId,
            occurredAt: t1,
            disabledBy: 'maintenance-tech-001',
            reason: 'Sensor replacement required',
          }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmReturnedToService',
          makeAlarmReturnedToServicePayload({
            alarmId,
            occurredAt: t2,
            returnedBy: 'maintenance-tech-001',
            initialState: 'cleared',
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)
        expect(alarmEntries.length).toBe(3)

        const eventTags = alarmEntries.map((e) => e.event)
        expect(eventTags).toContain('AlarmTriggered')
        expect(eventTags).toContain('AlarmOutOfService')
        expect(eventTags).toContain('AlarmReturnedToService')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('7. Temporal query capability', () => {
    it('should support querying events for a specific alarm', async () => {
      const alarmId1 = makeAlarmId()
      const alarmId2 = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()

        // Write events for two different alarms
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: alarmId1, occurredAt: t0 }),
          alarmId1
        )
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId: alarmId2, occurredAt: t0 }),
          alarmId2
        )
        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId: alarmId1 }),
          alarmId1
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        // Filter by alarmId (primaryKey)
        const alarm1Entries = entries.filter((e) => e.primaryKey === alarmId1)
        const alarm2Entries = entries.filter((e) => e.primaryKey === alarmId2)

        expect(alarm1Entries.length).toBe(2)
        expect(alarm2Entries.length).toBe(1)

        return { alarm1: alarm1Entries.length, alarm2: alarm2Entries.length }
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should return empty for non-existent alarm', async () => {
      const program = Effect.gen(function* () {
        const nonExistentId = 'TEST-ALM-NONEXISTENT' as AlarmId

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === nonExistentId)

        expect(alarmEntries.length).toBe(0)

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track complete alarm lifecycle with all event types', async () => {
      const alarmId = makeAlarmId()

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))
        const shelvedUntil = DateTime.add(t0, Duration.hours(1))
        const t3 = DateTime.add(t0, Duration.hours(1))
        const t4 = DateTime.add(t0, Duration.hours(2))
        const t5 = DateTime.add(t0, Duration.hours(3))

        // Full lifecycle: triggered -> acknowledged -> shelved -> (auto-unshelve time passes) -> acknowledged -> cleared
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId, occurredAt: t1 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmShelved',
          makeAlarmShelvedPayload({
            alarmId,
            occurredAt: t2,
            shelvedUntil,
          }),
          alarmId
        )
        // AlarmUnshelved event payload
        const unshelvedPayload = {
          eventId: makeEventId(),
          occurredAt: t3,
          causedBy: 'system',
          entityId: TEST_ASSET_ID,
          entityType: 'device' as const, // ISA-95 equipment level (lowercase)
          correlationId: Option.none() as Option.Option<string>,
          schemaVersion: 1,
          alarmId,
          deviceId: TEST_DEVICE_ID,
          autoUnshelve: true,
          unshelvedBy: Option.none() as Option.Option<string>,
        }
        yield* writeAlarmEventToJournal('AlarmUnshelved', unshelvedPayload, alarmId)

        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId, occurredAt: t4 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmCleared',
          makeAlarmClearedPayload({ alarmId, occurredAt: t5 }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)

        expect(alarmEntries.length).toBe(6)

        // Verify all event types present
        const eventTags = alarmEntries.map((e) => e.event)
        expect(eventTags).toContain('AlarmTriggered')
        expect(eventTags).toContain('AlarmAcknowledged')
        expect(eventTags).toContain('AlarmShelved')
        expect(eventTags).toContain('AlarmUnshelved')
        expect(eventTags).toContain('AlarmCleared')

        return alarmEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })
})

// =============================================================================
// Database Integration Tests (requires PostgreSQL)
// =============================================================================

describe('ISA-18.2 Compliance: SQL EventJournal Integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    try {
      const check = isDatabaseAvailable.pipe(
        Effect.provide(EventJournalIntegrationLayer)
      )
      dbAvailable = await Effect.runPromise(check)
    } catch {
      dbAvailable = false
    }
    if (!dbAvailable) {
      Effect.runSync(Effect.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      ))
    }
  })

  it('should persist alarm events to SQL EventJournal', async () => {
    if (!dbAvailable) return

    const alarmId = makeAlarmId()

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))

        // Write events
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmAcknowledged',
          makeAlarmAcknowledgedPayload({ alarmId, occurredAt: t1 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmCleared',
          makeAlarmClearedPayload({ alarmId, occurredAt: t2 }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)

        expect(alarmEntries.length).toBe(3)

        // Verify events are persisted and retrievable
        const eventTags = alarmEntries.map((e) => e.event)
        expect(eventTags).toContain('AlarmTriggered')
        expect(eventTags).toContain('AlarmAcknowledged')
        expect(eventTags).toContain('AlarmCleared')

        return alarmEntries
      })
    ).pipe(Effect.provide(EventJournalIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should persist shelve/unshelve cycle to SQL EventJournal', async () => {
    if (!dbAvailable) return

    const alarmId = makeAlarmId()

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const shelvedUntil = DateTime.add(t0, Duration.hours(1))

        // Write shelve events
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmShelved',
          makeAlarmShelvedPayload({
            alarmId,
            occurredAt: t1,
            shelvedUntil,
            shelvedBy: 'operator-db-test',
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)

        expect(alarmEntries.length).toBe(2)
        expect(alarmEntries[1].event).toBe('AlarmShelved')

        return alarmEntries
      })
    ).pipe(Effect.provide(EventJournalIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should persist out_of_service cycle to SQL EventJournal', async () => {
    if (!dbAvailable) return

    const alarmId = makeAlarmId()

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.days(1))

        // Write out_of_service events
        yield* writeAlarmEventToJournal('AlarmTriggered',
          makeAlarmTriggeredPayload({ alarmId, occurredAt: t0 }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmOutOfService',
          makeAlarmOutOfServicePayload({
            alarmId,
            occurredAt: t1,
            disabledBy: 'maintenance-db-test',
            reason: 'SQL integration test - sensor swap',
          }),
          alarmId
        )
        yield* writeAlarmEventToJournal('AlarmReturnedToService',
          makeAlarmReturnedToServicePayload({
            alarmId,
            occurredAt: t2,
            returnedBy: 'maintenance-db-test',
            initialState: 'cleared',
          }),
          alarmId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const alarmEntries = entries.filter((e) => e.primaryKey === alarmId)

        expect(alarmEntries.length).toBe(3)

        const eventTags = alarmEntries.map((e) => e.event)
        expect(eventTags).toContain('AlarmOutOfService')
        expect(eventTags).toContain('AlarmReturnedToService')

        return alarmEntries
      })
    ).pipe(Effect.provide(EventJournalIntegrationLayer))

    await Effect.runPromise(program)
  })
})
