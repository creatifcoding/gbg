/**
 * Work Order Event Sourcing Integration Tests
 *
 * Tests temporal queries and event sourcing for WorkOrder lifecycle.
 * Uses the EventLog/EventJournal pattern established for alarm temporal queries.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/work-order-es.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/integration/work-order-es
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, DateTime, Option, Duration, Layer, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  WorkOrderRepositoriesIntegrationLayer,
  withFullyCleanDatabase,
  isDatabaseAvailable,
} from './layer'
import { WorkOrderRepo } from '../../repos'
import { WorkOrderEvents } from '../../schemas/events/groups'
import type {
  WorkOrderId,
  WorkflowDefinitionId,
  AssetId,
  EventId,
} from '../../schemas/identifiers'
import type { WorkOrderStatus, WorkOrderPriority, WorkOrderOutcome } from '../../schemas/work-orders'
import { testIds, testWorkOrder1Insert, testWorkOrder2Insert } from '../__fixtures__/fixtures'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_WORK_ORDER_ID = 'WO-TEST-ES-001' as WorkOrderId
const TEST_WORKFLOW_DEF_ID = testIds.workflowDef1
const TEST_ASSET_ID = testIds.machine1 as unknown as AssetId

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

// =============================================================================
// Event Payload Factories
// =============================================================================

const makeWorkOrderCreatedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'test-user',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  templateId: Option.some(TEST_WORKFLOW_DEF_ID),
  priority: 'normal' as WorkOrderPriority,
  scheduledStart: Option.none() as Option.Option<DateTime.Utc>,
  assignedTo: Option.some('maintenance-team'),
  title: 'Test Work Order - ES Integration',
  description: Option.some('Integration test work order'),
  metadata: Option.none() as Option.Option<Record<string, unknown>>,
})

const makeWorkOrderSubmittedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'test-user',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  comments: Option.some('Ready for review'),
})

const makeWorkOrderApprovedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'supervisor',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  approvedBy: 'supervisor-001',
  approvalLevel: 1,
  comments: Option.some('Approved for execution'),
})

const makeWorkOrderRejectedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'supervisor',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  rejectedBy: 'supervisor-001',
  reason: 'Missing safety documentation',
})

const makeWorkOrderStartedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  startedBy: 'technician-001',
  assignedTo: Option.some('technician-001'),
})

const makeWorkOrderSuspendedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  suspendedBy: 'technician-001',
  reason: 'awaiting_parts' as const,
  expectedResume: Option.some(DateTime.add(DateTime.unsafeNow(), Duration.hours(4))),
  notes: Option.some('Waiting for replacement motor'),
})

const makeWorkOrderResumedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  resumedBy: 'technician-001',
  notes: Option.some('Parts received, resuming work'),
})

const makeWorkOrderCompletedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  completedBy: 'technician-001',
  outcome: 'success' as WorkOrderOutcome,
  summary: 'Motor replaced and tested successfully',
  actualDurationMinutes: Option.some(180),
})

const makeWorkOrderFailedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'technician',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  failedTaskId: Option.none(),
  failureReason: 'Cannot complete - additional parts needed',
  reportedBy: 'technician-001',
})

const makeWorkOrderCancelledPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'supervisor',
  entityId: TEST_ASSET_ID,
  entityType: 'machine' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? TEST_WORK_ORDER_ID,
  cancelledBy: 'supervisor-001',
  reason: 'Equipment decommissioned',
  compensationRequired: false,
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
const writeEventToJournal = <Tag extends keyof typeof WorkOrderEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string
): Effect.Effect<void, EventJournal.EventJournalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const event = WorkOrderEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }

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

describe('WorkOrderRepo CRUD Operations (Database)', () => {
  let dbAvailable = false

  beforeAll(async () => {
    try {
      const check = isDatabaseAvailable.pipe(
        Effect.provide(WorkOrderRepositoriesIntegrationLayer)
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

  it('should insert and retrieve a work order', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert
        const inserted = yield* repo.insert(testWorkOrder1Insert)
        expect(inserted.title).toBe(testWorkOrder1Insert.title)
        expect(inserted.status).toBe('created')
        expect(inserted.type).toBe('preventive_maintenance')

        // Retrieve
        const found = yield* repo.findById(inserted.id)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.title).toBe(testWorkOrder1Insert.title)
        }

        return inserted
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should start a work order', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert and start
        const inserted = yield* repo.insert(testWorkOrder1Insert)
        const started = yield* repo.start(inserted.id)

        expect(started.status).toBe('started')
        expect(Option.isSome(started.actualStart)).toBe(true)

        return started
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should complete a work order', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert, start, and complete
        const inserted = yield* repo.insert(testWorkOrder1Insert)
        yield* repo.start(inserted.id)
        const completed = yield* repo.complete(inserted.id, 'Work completed successfully')

        expect(completed.status).toBe('completed')
        expect(Option.isSome(completed.actualEnd)).toBe(true)
        expect(Option.getOrNull(completed.summary)).toBe('Work completed successfully')

        return completed
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should cancel a work order', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert and cancel
        const inserted = yield* repo.insert(testWorkOrder1Insert)
        const cancelled = yield* repo.cancel(inserted.id, 'Equipment no longer available')

        expect(cancelled.status).toBe('cancelled')
        expect(Option.getOrNull(cancelled.cancellationReason)).toBe('Equipment no longer available')

        return cancelled
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should query work orders by status', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert multiple work orders
        yield* repo.insert(testWorkOrder1Insert)
        yield* repo.insert(testWorkOrder2Insert)

        // Query by status
        const created = yield* repo.findByStatus('created')
        expect(created.length).toBeGreaterThanOrEqual(2)

        return created
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('should find open work orders', async () => {
    if (!dbAvailable) return

    const program = withFullyCleanDatabase(
      Effect.gen(function* () {
        const repo = yield* WorkOrderRepo

        // Insert and start one
        const wo1 = yield* repo.insert(testWorkOrder1Insert)
        yield* repo.insert(testWorkOrder2Insert)
        yield* repo.start(wo1.id)

        // Find open (not closed/rejected/cancelled)
        const open = yield* repo.findOpen()
        expect(open.length).toBeGreaterThanOrEqual(2)

        return open
      })
    ).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// Event Sourcing Tests (in-memory EventJournal - no database required)
// =============================================================================

describe('WorkOrder Event Sourcing (EventJournal)', () => {
  describe('Event Writing and Reading', () => {
    it('should write WorkOrderCreated event to journal', async () => {
      const program = Effect.gen(function* () {
        const payload = makeWorkOrderCreatedPayload()
        yield* writeEventToJournal('WorkOrderCreated', payload, TEST_WORK_ORDER_ID)

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) =>
          e.primaryKey === TEST_WORK_ORDER_ID && e.event === 'WorkOrderCreated'
        )

        expect(woEntries.length).toBe(1)
        expect(woEntries[0].event).toBe('WorkOrderCreated')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should write full lifecycle events to journal', async () => {
      const testWoId = 'WO-TEST-lifecycle-001' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))
        const t2 = DateTime.add(t0, Duration.minutes(20))
        const t3 = DateTime.add(t0, Duration.minutes(30))
        const t4 = DateTime.add(t0, Duration.minutes(120))

        // Write lifecycle events
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId, occurredAt: t0 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWoId, occurredAt: t1 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWoId, occurredAt: t2 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderStarted',
          makeWorkOrderStartedPayload({ workOrderId: testWoId, occurredAt: t3 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderCompleted',
          makeWorkOrderCompletedPayload({ workOrderId: testWoId, occurredAt: t4 }),
          testWoId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === testWoId)

        expect(woEntries.length).toBe(5)

        // Verify event tags in order written
        const eventTags = woEntries.map((e) => e.event)
        expect(eventTags).toContain('WorkOrderCreated')
        expect(eventTags).toContain('WorkOrderSubmitted')
        expect(eventTags).toContain('WorkOrderApproved')
        expect(eventTags).toContain('WorkOrderStarted')
        expect(eventTags).toContain('WorkOrderCompleted')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track rejected work order in journal', async () => {
      const testWoId = 'WO-TEST-rejected-001' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))
        const t2 = DateTime.add(t0, Duration.minutes(20))

        // Write events leading to rejection
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId, occurredAt: t0 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWoId, occurredAt: t1 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderRejected',
          makeWorkOrderRejectedPayload({ workOrderId: testWoId, occurredAt: t2 }),
          testWoId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === testWoId)

        expect(woEntries.length).toBe(3)

        const eventTags = woEntries.map((e) => e.event)
        expect(eventTags).toContain('WorkOrderRejected')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track suspended and resumed work order', async () => {
      const testWoId = 'WO-TEST-suspended-001' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))
        const t2 = DateTime.add(t0, Duration.minutes(20))
        const t3 = DateTime.add(t0, Duration.minutes(30))
        const t4 = DateTime.add(t0, Duration.hours(4))
        const t5 = DateTime.add(t0, Duration.hours(6))

        // Write suspend/resume lifecycle
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId, occurredAt: t0 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWoId, occurredAt: t1 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWoId, occurredAt: t2 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderStarted',
          makeWorkOrderStartedPayload({ workOrderId: testWoId, occurredAt: t3 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderSuspended',
          makeWorkOrderSuspendedPayload({ workOrderId: testWoId, occurredAt: t4 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderResumed',
          makeWorkOrderResumedPayload({ workOrderId: testWoId, occurredAt: t5 }),
          testWoId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === testWoId)

        expect(woEntries.length).toBe(6)

        const eventTags = woEntries.map((e) => e.event)
        expect(eventTags).toContain('WorkOrderSuspended')
        expect(eventTags).toContain('WorkOrderResumed')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track failed work order in journal', async () => {
      const testWoId = 'WO-TEST-failed-001' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))
        const t2 = DateTime.add(t0, Duration.minutes(20))
        const t3 = DateTime.add(t0, Duration.minutes(30))
        const t4 = DateTime.add(t0, Duration.hours(2))

        // Write events leading to failure
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId, occurredAt: t0 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWoId, occurredAt: t1 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWoId, occurredAt: t2 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderStarted',
          makeWorkOrderStartedPayload({ workOrderId: testWoId, occurredAt: t3 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderFailed',
          makeWorkOrderFailedPayload({ workOrderId: testWoId, occurredAt: t4 }),
          testWoId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === testWoId)

        expect(woEntries.length).toBe(5)

        const eventTags = woEntries.map((e) => e.event)
        expect(eventTags).toContain('WorkOrderFailed')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should track cancelled work order in journal', async () => {
      const testWoId = 'WO-TEST-cancelled-001' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(10))

        // Write creation and cancellation
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId, occurredAt: t0 }),
          testWoId
        )
        yield* writeEventToJournal('WorkOrderCancelled',
          makeWorkOrderCancelledPayload({ workOrderId: testWoId, occurredAt: t1 }),
          testWoId
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === testWoId)

        expect(woEntries.length).toBe(2)

        const eventTags = woEntries.map((e) => e.event)
        expect(eventTags).toContain('WorkOrderCancelled')

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })

  describe('Event Count and Filtering', () => {
    it('should filter events by work order ID', async () => {
      const testWoId1 = 'WO-TEST-filter-001' as WorkOrderId
      const testWoId2 = 'WO-TEST-filter-002' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()

        // Write events for two different work orders
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId1, occurredAt: t0 }),
          testWoId1
        )
        yield* writeEventToJournal('WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWoId2, occurredAt: t0 }),
          testWoId2
        )
        yield* writeEventToJournal('WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWoId1, occurredAt: t0 }),
          testWoId1
        )

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const wo1Entries = entries.filter((e) => e.primaryKey === testWoId1)
        const wo2Entries = entries.filter((e) => e.primaryKey === testWoId2)

        expect(wo1Entries.length).toBe(2)
        expect(wo2Entries.length).toBe(1)

        return { wo1: wo1Entries.length, wo2: wo2Entries.length }
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })

    it('should return empty array for non-existent work order', async () => {
      const program = Effect.gen(function* () {
        const nonExistentId = 'WO-NONEXISTENT' as WorkOrderId

        const journal = yield* EventJournal.EventJournal
        const entries = yield* journal.entries

        const woEntries = entries.filter((e) => e.primaryKey === nonExistentId)

        expect(woEntries.length).toBe(0)

        return woEntries
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await Effect.runPromise(program)
    })
  })
})
