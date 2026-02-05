/**
 * Equipment State Event Sourcing Integration Tests
 *
 * Tests temporal queries and event sourcing for EquipmentState lifecycle.
 * Uses the EventLog/EventJournal pattern established for alarm temporal queries.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/equipment-state-es.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/integration/equipment-state-es
 * @see ISA-95/IEC 62264 for equipment state definitions
 * @see OEE calculations: Availability x Performance x Quality
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, DateTime, Option, Duration, Layer, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EquipmentStateRepositoriesIntegrationLayer,
  withFullyCleanDatabase,
  isDatabaseAvailable,
} from './layer'
import { EquipmentStateRepo } from '../../repos'
import { EquipmentStateEvents } from '../../schemas/events/groups'
import type {
  MachineId,
  AssetId,
  EventId,
} from '../../schemas/identifiers'
import type { EquipmentStateId, StateType, StateReason } from '../../schemas/equipment-state/schema'
import { testIds, testEquipmentState1Insert, testEquipmentState2Insert, testEquipmentStatePlannedDowntimeInsert, testEquipmentStateUnplannedDowntimeInsert, testEquipmentStateSetupInsert } from '../__fixtures__/fixtures'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_MACHINE_ID = testIds.machine1
const TEST_ASSET_ID = testIds.machine1 as unknown as AssetId

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

// =============================================================================
// Event Payload Factories (ISA-95/OEE Compliant States)
// =============================================================================

/**
 * Equipment State Change event types per groups.ts:
 * - EquipmentStateChanged: General state transition
 * - MaintenanceModeEntered: Equipment enters maintenance
 * - MaintenanceModeExited: Equipment exits maintenance
 * - PerformanceDegraded: Operating below optimal
 * - FaultDetected: Equipment fault occurred
 * - FaultCleared: Fault resolved
 *
 * Enum values (from operational/equipment-state-events.ts):
 * - MaintenanceType: 'scheduled' | 'unscheduled' | 'emergency'
 * - MaintenanceOutcome: 'completed' | 'aborted' | 'deferred'
 * - FaultSeverity: 'minor' | 'major' | 'critical'
 * - FaultClearMethod: 'manual' | 'auto' | 'override'
 */

const makeEquipmentStateChangedPayload = (overrides?: Partial<{
  machineId: MachineId
  previousState: 'operational' | 'degraded' | 'faulted' | 'maintenance' | 'offline'
  newState: 'operational' | 'degraded' | 'faulted' | 'maintenance' | 'offline'
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  previousState: overrides?.previousState ?? 'offline',
  newState: overrides?.newState ?? 'operational',
  reason: Option.some('Normal operation started'),
  triggeredBy: Option.some('operator-001'),
})

const makeMaintenanceModeEnteredPayload = (overrides?: Partial<{
  machineId: MachineId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  maintenanceType: 'scheduled' as const, // Valid: 'scheduled' | 'unscheduled' | 'emergency'
  scheduledDuration: Option.some(120), // 2 hours
  workOrderId: Option.some('WO-TEST-001'),
  technician: Option.some('technician-001'),
  notes: Option.some('Scheduled weekly maintenance'),
})

const makeMaintenanceModeExitedPayload = (overrides?: Partial<{
  machineId: MachineId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  actualDuration: 115, // 1h 55min
  outcome: 'completed' as const, // Valid: 'completed' | 'aborted' | 'deferred'
  workOrderId: Option.some('WO-TEST-001'),
  technician: Option.some('technician-001'),
  nextMaintenanceDate: Option.some(DateTime.add(DateTime.unsafeNow(), Duration.days(7))),
  notes: Option.some('All checks completed successfully'),
})

const makePerformanceDegradedPayload = (overrides?: Partial<{
  machineId: MachineId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  performancePercent: 75,
  expectedPerformance: 95,
  degradationReason: Option.some('Bearing wear detected'),
  affectedMetrics: ['speed', 'quality'],
  oeeImpact: Option.some(0.15), // 15% OEE reduction
})

const makeFaultDetectedPayload = (overrides?: Partial<{
  machineId: MachineId
  occurredAt: DateTime.Utc
  faultCode?: string
  faultSeverity?: 'minor' | 'major' | 'critical' // Valid values per FaultSeverity schema
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  faultCode: overrides?.faultCode ?? 'E-101',
  faultSeverity: overrides?.faultSeverity ?? 'major', // Valid: 'minor' | 'major' | 'critical'
  faultDescription: 'Motor overtemperature detected',
  affectedComponent: Option.some('main-motor'),
  sensorReadings: Option.some({ temperature: 95.5, current: 18.2 }),
  recommendedAction: Option.some('Reduce load and inspect cooling system'),
})

const makeFaultClearedPayload = (overrides?: Partial<{
  machineId: MachineId
  occurredAt: DateTime.Utc
  faultCode?: string
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  machineId: overrides?.machineId ?? TEST_MACHINE_ID,
  faultCode: overrides?.faultCode ?? 'E-101',
  clearMethod: 'manual' as const, // Valid: 'manual' | 'auto' | 'override'
  verifiedBy: Option.some('technician-001'),
  resolutionNotes: Option.some('Cooling fan replaced, temperature normalized'),
  downtime: Option.some(45), // 45 minutes downtime
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
const writeEventToJournal = <Tag extends keyof typeof EquipmentStateEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string
): Effect.Effect<void, EventJournal.EventJournalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const event = EquipmentStateEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }

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
// Database Integration Tests (requires PostgreSQL)
// =============================================================================

describe('EquipmentStateRepo CRUD Operations (Database)', () => {
  let dbAvailable = false

  beforeAll(async () => {
    try {
      const check = isDatabaseAvailable.pipe(
        Effect.provide(EquipmentStateRepositoriesIntegrationLayer)
      )
      dbAvailable = await Effect.runPromise(check)
    } catch {
      dbAvailable = false
    }
    if (!dbAvailable) {
      console.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  it('should insert and retrieve an equipment state', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert
        const inserted = yield* repo.insert(testEquipmentState1Insert)
        expect(inserted.state).toBe('running')
        expect(Option.isSome(inserted.reason)).toBe(true)
        expect(Option.getOrNull(inserted.reason)).toBe('production')

        // Retrieve
        const found = yield* repo.findById(inserted.id)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.state).toBe('running')
          expect(found.value.machineId).toBe(testIds.machine1)
        }

        return inserted
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should find active equipment states', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert active states (endedAt = None)
        yield* repo.insert(testEquipmentState1Insert)
        yield* repo.insert(testEquipmentState2Insert)

        // Find active
        const active = yield* repo.findActive()
        expect(active.length).toBeGreaterThanOrEqual(2)
        active.forEach((state) => {
          expect(Option.isNone(state.endedAt)).toBe(true)
        })

        return active
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should end an equipment state', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert and end
        const inserted = yield* repo.insert(testEquipmentState1Insert)
        const endedAt = new Date()
        const ended = yield* repo.endState(inserted.id, endedAt)

        expect(Option.isSome(ended.endedAt)).toBe(true)

        return ended
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should find equipment states by machine', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert states for same machine
        yield* repo.insert(testEquipmentState1Insert)
        yield* repo.insert(testEquipmentState2Insert)

        // Find by machine
        const states = yield* repo.findByMachine(testIds.machine1)
        expect(states.length).toBeGreaterThanOrEqual(2)
        states.forEach((state) => {
          expect(state.machineId).toBe(testIds.machine1)
        })

        return states
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should find equipment states by state type', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert different state types
        yield* repo.insert(testEquipmentState1Insert) // running
        yield* repo.insert(testEquipmentState2Insert) // idle
        yield* repo.insert(testEquipmentStatePlannedDowntimeInsert) // planned_downtime

        // Find by state type
        const runningStates = yield* repo.findByState('running')
        expect(runningStates.length).toBeGreaterThanOrEqual(1)
        runningStates.forEach((state) => {
          expect(state.state).toBe('running')
        })

        return runningStates
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should query equipment states with filters', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* EquipmentStateRepo

        // Insert various states
        yield* repo.insert(testEquipmentState1Insert) // running, machine1
        yield* repo.insert(testEquipmentStateSetupInsert) // setup, machine2

        // Query with filters
        const machineStates = yield* repo.query({
          machineId: testIds.machine1,
          onlyActive: true,
          limit: 10,
        })

        expect(machineStates.length).toBeGreaterThanOrEqual(1)
        machineStates.forEach((state) => {
          expect(state.machineId).toBe(testIds.machine1)
          expect(Option.isNone(state.endedAt)).toBe(true)
        })

        return machineStates
      })
    ).pipe(Effect.provide(EquipmentStateRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// Event Sourcing Tests (in-memory EventJournal - no database required)
// =============================================================================

describe('EquipmentState Event Sourcing (EventJournal)', () => {
  describe('State Transition Events', () => {
    it('should write EquipmentStateChanged event to journal', async () => {
      const program = Effect.gen(function* () {
        const payload = makeEquipmentStateChangedPayload()
        yield* writeEventToJournal('EquipmentStateChanged', payload, TEST_MACHINE_ID)

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) =>
          e.primaryKey === TEST_MACHINE_ID && e.event === 'EquipmentStateChanged'
        )

        expect(machineEntries.length).toBe(1)
        expect(machineEntries[0].event).toBe('EquipmentStateChanged')

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track full state transition chain', async () => {
      const testMachineId = 'TEST-MCH-state-chain' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.hours(1))
        const t2 = DateTime.add(t0, Duration.hours(2))

        // Write state transitions: offline -> operational -> degraded -> operational
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'offline',
            newState: 'operational',
            occurredAt: t0,
          }),
          testMachineId
        )
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'operational',
            newState: 'degraded',
            occurredAt: t1,
          }),
          testMachineId
        )
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'degraded',
            newState: 'operational',
            occurredAt: t2,
          }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(3)

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Maintenance Mode Events', () => {
    it('should track maintenance mode enter and exit', async () => {
      const testMachineId = 'TEST-MCH-maint-001' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.hours(2))

        // Enter and exit maintenance
        yield* writeEventToJournal('MaintenanceModeEntered',
          makeMaintenanceModeEnteredPayload({ machineId: testMachineId, occurredAt: t0 }),
          testMachineId
        )
        yield* writeEventToJournal('MaintenanceModeExited',
          makeMaintenanceModeExitedPayload({ machineId: testMachineId, occurredAt: t1 }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(2)

        const eventTags = machineEntries.map((e) => e.event)
        expect(eventTags).toContain('MaintenanceModeEntered')
        expect(eventTags).toContain('MaintenanceModeExited')

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Fault Detection Events', () => {
    it('should track fault detection and clearing', async () => {
      const testMachineId = 'TEST-MCH-fault-001' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(45))

        // Detect and clear fault
        yield* writeEventToJournal('FaultDetected',
          makeFaultDetectedPayload({ machineId: testMachineId, occurredAt: t0 }),
          testMachineId
        )
        yield* writeEventToJournal('FaultCleared',
          makeFaultClearedPayload({ machineId: testMachineId, occurredAt: t1 }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(2)

        const eventTags = machineEntries.map((e) => e.event)
        expect(eventTags).toContain('FaultDetected')
        expect(eventTags).toContain('FaultCleared')

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track multiple faults with different codes', async () => {
      const testMachineId = 'TEST-MCH-multi-fault' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(30))
        const t2 = DateTime.add(t0, Duration.hours(1))
        const t3 = DateTime.add(t0, Duration.hours(2))

        // Multiple faults and clears
        yield* writeEventToJournal('FaultDetected',
          makeFaultDetectedPayload({
            machineId: testMachineId,
            faultCode: 'E-101',
            faultSeverity: 'major', // Valid: 'minor' | 'major' | 'critical'
            occurredAt: t0,
          }),
          testMachineId
        )
        yield* writeEventToJournal('FaultCleared',
          makeFaultClearedPayload({
            machineId: testMachineId,
            faultCode: 'E-101',
            occurredAt: t1,
          }),
          testMachineId
        )
        yield* writeEventToJournal('FaultDetected',
          makeFaultDetectedPayload({
            machineId: testMachineId,
            faultCode: 'E-202',
            faultSeverity: 'critical', // Valid: 'minor' | 'major' | 'critical'
            occurredAt: t2,
          }),
          testMachineId
        )
        yield* writeEventToJournal('FaultCleared',
          makeFaultClearedPayload({
            machineId: testMachineId,
            faultCode: 'E-202',
            occurredAt: t3,
          }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(4)

        const faultEvents = machineEntries.filter((e) => e.event === 'FaultDetected')
        const clearEvents = machineEntries.filter((e) => e.event === 'FaultCleared')

        expect(faultEvents.length).toBe(2)
        expect(clearEvents.length).toBe(2)

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Performance Degradation Events', () => {
    it('should track performance degradation', async () => {
      const testMachineId = 'TEST-MCH-perf-001' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()

        // Record performance degradation
        yield* writeEventToJournal('PerformanceDegraded',
          makePerformanceDegradedPayload({ machineId: testMachineId, occurredAt: t0 }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(1)
        expect(machineEntries[0].event).toBe('PerformanceDegraded')

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Complex State Lifecycle', () => {
    it('should track complete equipment lifecycle with all event types', async () => {
      const testMachineId = 'TEST-MCH-full-lifecycle' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.hours(1))
        const t2 = DateTime.add(t0, Duration.hours(2))
        const t3 = DateTime.add(t0, Duration.hours(3))
        const t4 = DateTime.add(t0, Duration.hours(4))
        const t5 = DateTime.add(t0, Duration.hours(5))
        const t6 = DateTime.add(t0, Duration.hours(6))
        const t7 = DateTime.add(t0, Duration.hours(7))

        // Full lifecycle: startup -> degraded -> fault -> maintenance -> operational
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'offline',
            newState: 'operational',
            occurredAt: t0,
          }),
          testMachineId
        )
        yield* writeEventToJournal('PerformanceDegraded',
          makePerformanceDegradedPayload({ machineId: testMachineId, occurredAt: t1 }),
          testMachineId
        )
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'operational',
            newState: 'degraded',
            occurredAt: t2,
          }),
          testMachineId
        )
        yield* writeEventToJournal('FaultDetected',
          makeFaultDetectedPayload({ machineId: testMachineId, occurredAt: t3 }),
          testMachineId
        )
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({
            machineId: testMachineId,
            previousState: 'degraded',
            newState: 'faulted',
            occurredAt: t4,
          }),
          testMachineId
        )
        yield* writeEventToJournal('MaintenanceModeEntered',
          makeMaintenanceModeEnteredPayload({ machineId: testMachineId, occurredAt: t5 }),
          testMachineId
        )
        yield* writeEventToJournal('FaultCleared',
          makeFaultClearedPayload({ machineId: testMachineId, occurredAt: t6 }),
          testMachineId
        )
        yield* writeEventToJournal('MaintenanceModeExited',
          makeMaintenanceModeExitedPayload({ machineId: testMachineId, occurredAt: t7 }),
          testMachineId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === testMachineId)

        expect(machineEntries.length).toBe(8)

        // Verify all event types present
        const eventTags = machineEntries.map((e) => e.event)
        expect(eventTags).toContain('EquipmentStateChanged')
        expect(eventTags).toContain('PerformanceDegraded')
        expect(eventTags).toContain('FaultDetected')
        expect(eventTags).toContain('FaultCleared')
        expect(eventTags).toContain('MaintenanceModeEntered')
        expect(eventTags).toContain('MaintenanceModeExited')

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Event Filtering', () => {
    it('should filter events by machine ID', async () => {
      const testMachineId1 = 'TEST-MCH-filter-001' as MachineId
      const testMachineId2 = 'TEST-MCH-filter-002' as MachineId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()

        // Write events for two different machines
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({ machineId: testMachineId1, occurredAt: t0 }),
          testMachineId1
        )
        yield* writeEventToJournal('EquipmentStateChanged',
          makeEquipmentStateChangedPayload({ machineId: testMachineId2, occurredAt: t0 }),
          testMachineId2
        )
        yield* writeEventToJournal('FaultDetected',
          makeFaultDetectedPayload({ machineId: testMachineId1, occurredAt: t0 }),
          testMachineId1
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machine1Entries = entries.filter((e) => e.primaryKey === testMachineId1)
        const machine2Entries = entries.filter((e) => e.primaryKey === testMachineId2)

        expect(machine1Entries.length).toBe(2)
        expect(machine2Entries.length).toBe(1)

        return { machine1: machine1Entries.length, machine2: machine2Entries.length }
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should return empty array for non-existent machine', async () => {
      const program = Effect.gen(function* () {
        const nonExistentId = 'MCH-NONEXISTENT' as MachineId

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const machineEntries = entries.filter((e) => e.primaryKey === nonExistentId)

        expect(machineEntries.length).toBe(0)

        return machineEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })
})
