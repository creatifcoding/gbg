/**
 * Work Order Temporal Queries - Unit Tests
 *
 * Tests for temporal work order state reconstruction from EventLog.
 *
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ADR-0012 for EventLog boundaries
 */

import { describe, it, expect } from 'vitest'
import { Effect, DateTime, Option, Layer, Duration, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  getWorkOrderAtTime,
  getWorkOrderHistory,
  foldWorkOrderEvents,
  WorkOrderTemporalError,
} from '../work-order-temporal'
import { WorkOrderEvents } from '../../../schemas/events/groups'
import type { WorkOrderId, WorkflowDefinitionId, AssetId, EventId } from '../../../schemas/identifiers'
import type { WorkOrderPriority, SuspensionReason, WorkOrderOutcome, WorkOrderFinalStatus } from '../../../schemas/work-orders'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockWorkOrderId = 'WO-test-001' as WorkOrderId
const mockWorkflowDefId = 'WF-pm-001' as WorkflowDefinitionId
const mockAssetId = 'AST-test-001' as AssetId

const makeEventId = (): EventId => `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

/**
 * Create WorkOrderCreated payload matching EventGroup schema
 */
const makeWorkOrderCreatedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'user-123',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  templateId: Option.some(mockWorkflowDefId),
  priority: 'normal' as WorkOrderPriority,
  scheduledStart: Option.none() as Option.Option<DateTime.Utc>,
  assignedTo: Option.none() as Option.Option<string>,
  title: 'Monthly PM - Line 1',
  description: Option.some('Scheduled preventive maintenance'),
  metadata: Option.none(),
})

const makeWorkOrderSubmittedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'user-123',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  comments: Option.some('Ready for review'),
})

const makeWorkOrderApprovedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'supervisor-1',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  approvedBy: 'supervisor-1',
  approvalLevel: 1,
  comments: Option.some('Approved to proceed'),
})

const makeWorkOrderStartedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-1',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  startedBy: 'operator-1',
  assignedTo: Option.some('operator-1'),
})

const makeWorkOrderSuspendedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-1',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  suspendedBy: 'operator-1',
  reason: 'awaiting_parts' as SuspensionReason,
  expectedResume: Option.some(DateTime.add(DateTime.unsafeNow(), Duration.hours(4))),
  notes: Option.some('Waiting for replacement part delivery'),
})

const makeWorkOrderResumedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-1',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  resumedBy: 'operator-1',
  notes: Option.some('Parts received, resuming work'),
})

const makeWorkOrderCompletedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-1',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  completedBy: 'operator-1',
  outcome: 'success' as WorkOrderOutcome,
  summary: 'All tasks completed successfully',
  actualDurationMinutes: Option.some(120),
})

const makeWorkOrderClosedPayload = (overrides?: Partial<{
  workOrderId: WorkOrderId
  occurredAt: DateTime.Utc
}>) => ({
  eventId: makeEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: mockAssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  workOrderId: overrides?.workOrderId ?? mockWorkOrderId,
  closedBy: 'system',
  finalStatus: 'completed_success' as WorkOrderFinalStatus,
  archiveReference: Option.some('ARCH-2026-001'),
  notes: Option.none(),
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
const writeEventToJournal = <Tag extends keyof typeof WorkOrderEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string,
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
// Feature: Temporal Work Order State Reconstruction
// =============================================================================

describe('Feature: Temporal Work Order State Reconstruction', () => {
  describe('Scenario: Get work order state at a specific time', () => {
    it('Given work order events, When querying at creation time, Then state should be created', async () => {
      const program = Effect.gen(function* () {
        const createTime = DateTime.unsafeNow()
        const payload = makeWorkOrderCreatedPayload({ occurredAt: createTime })

        // Write event directly to journal
        yield* writeEventToJournal('WorkOrderCreated', payload, mockWorkOrderId)

        // Query at creation time (plus a small offset)
        const queryTime = DateTime.add(createTime, Duration.millis(100))
        const result = yield* getWorkOrderAtTime(mockWorkOrderId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result._tag).toBe('WorkOrderAtTime')
      expect(result.workOrder.status).toBe('created')
      expect(result.fromReplay).toBe(true)
    })

    it('Given work order submitted later, When querying before submit, Then state should be created', async () => {
      const testWorkOrderId = 'WO-query-before-submit' as WorkOrderId

      const program = Effect.gen(function* () {
        const baseTime = Date.now()
        const createTime = DateTime.unsafeMake(baseTime)
        const queryTime = DateTime.unsafeMake(baseTime + 120000) // +2 minutes
        const submitTime = DateTime.unsafeMake(baseTime + 300000) // +5 minutes

        yield* writeEventToJournal(
          'WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWorkOrderId, occurredAt: createTime }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWorkOrderId, occurredAt: submitTime }),
          testWorkOrderId
        )

        const result = yield* getWorkOrderAtTime(testWorkOrderId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.workOrder.status).toBe('created')
    })

    it('Given work order approved, When querying after approval, Then state should be approved', async () => {
      const testWorkOrderId = 'WO-query-after-approval' as WorkOrderId

      const program = Effect.gen(function* () {
        const createTime = DateTime.unsafeNow()
        const submitTime = DateTime.add(createTime, Duration.minutes(5))
        const approvalTime = DateTime.add(createTime, Duration.minutes(10))
        const queryTime = DateTime.add(approvalTime, Duration.minutes(1))

        yield* writeEventToJournal(
          'WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWorkOrderId, occurredAt: createTime }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWorkOrderId, occurredAt: submitTime }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWorkOrderId, occurredAt: approvalTime }),
          testWorkOrderId
        )

        const result = yield* getWorkOrderAtTime(testWorkOrderId, queryTime)

        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.workOrder.status).toBe('approved')
    })

    it('Given no events for work order, When querying, Then should return WorkOrderTemporalError', async () => {
      const program = Effect.gen(function* () {
        const unknownWorkOrderId = 'WO-nonexistent' as WorkOrderId
        const result = yield* getWorkOrderAtTime(unknownWorkOrderId, DateTime.unsafeNow())
        return result
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      await expect(Effect.runPromise(program)).rejects.toThrow()
    })
  })

  describe('Scenario: Get full work order history', () => {
    it('Given multiple state transitions, When getting history, Then should return all transitions', async () => {
      const testWorkOrderId = 'WO-history-multi' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))
        const t3 = DateTime.add(t0, Duration.minutes(15))
        const t4 = DateTime.add(t0, Duration.minutes(120))
        const t5 = DateTime.add(t0, Duration.minutes(125))

        // Write event sequence: created -> submitted -> approved -> started -> completed -> closed
        yield* writeEventToJournal(
          'WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWorkOrderId, occurredAt: t0 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWorkOrderId, occurredAt: t1 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWorkOrderId, occurredAt: t2 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderStarted',
          makeWorkOrderStartedPayload({ workOrderId: testWorkOrderId, occurredAt: t3 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderCompleted',
          makeWorkOrderCompletedPayload({ workOrderId: testWorkOrderId, occurredAt: t4 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderClosed',
          makeWorkOrderClosedPayload({ workOrderId: testWorkOrderId, occurredAt: t5 }),
          testWorkOrderId
        )

        const history = yield* getWorkOrderHistory(testWorkOrderId)

        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.length).toBe(6)

      // First transition: -> created
      expect(result[0].toState).toBe('created')

      // Second transition: created -> submitted
      expect(result[1].fromState).toBe('created')
      expect(result[1].toState).toBe('submitted')

      // Third transition: submitted -> approved
      expect(result[2].fromState).toBe('submitted')
      expect(result[2].toState).toBe('approved')

      // Fourth transition: approved -> started
      expect(result[3].fromState).toBe('approved')
      expect(result[3].toState).toBe('started')

      // Fifth transition: started -> completed
      expect(result[4].fromState).toBe('started')
      expect(result[4].toState).toBe('completed')

      // Sixth transition: completed -> closed
      expect(result[5].fromState).toBe('completed')
      expect(result[5].toState).toBe('closed')
    })

    it('Given work order with suspend/resume cycle, When getting history, Then should include all states', async () => {
      const testWorkOrderId = 'WO-suspend-test' as WorkOrderId

      const program = Effect.gen(function* () {
        const t0 = DateTime.unsafeNow()
        const t1 = DateTime.add(t0, Duration.minutes(5))
        const t2 = DateTime.add(t0, Duration.minutes(10))
        const t3 = DateTime.add(t0, Duration.minutes(15))
        const t4 = DateTime.add(t0, Duration.minutes(240)) // 4 hours later

        yield* writeEventToJournal(
          'WorkOrderCreated',
          makeWorkOrderCreatedPayload({ workOrderId: testWorkOrderId, occurredAt: t0 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderSubmitted',
          makeWorkOrderSubmittedPayload({ workOrderId: testWorkOrderId, occurredAt: t1 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderApproved',
          makeWorkOrderApprovedPayload({ workOrderId: testWorkOrderId, occurredAt: t2 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderStarted',
          makeWorkOrderStartedPayload({ workOrderId: testWorkOrderId, occurredAt: t3 }),
          testWorkOrderId
        )
        yield* writeEventToJournal(
          'WorkOrderSuspended',
          makeWorkOrderSuspendedPayload({ workOrderId: testWorkOrderId, occurredAt: t4 }),
          testWorkOrderId
        )

        const history = yield* getWorkOrderHistory(testWorkOrderId)

        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result.length).toBe(5)
      expect(result[4].toState).toBe('suspended')
      expect(result[4].reason).toBe('awaiting_parts')
    })

    it('Given no events for work order, When getting history, Then should return empty array', async () => {
      const program = Effect.gen(function* () {
        const unknownWorkOrderId = 'WO-no-history' as WorkOrderId
        const history = yield* getWorkOrderHistory(unknownWorkOrderId)
        return history
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })
  })

  describe('Scenario: Fold work order events to state', () => {
    it('Given WorkOrderCreated only, When folding, Then should produce created work order', () => {
      const events = [
        { _tag: 'WorkOrderCreated' as const, ...makeWorkOrderCreatedPayload() },
      ]

      const workOrder = foldWorkOrderEvents(events, mockWorkOrderId)

      expect(workOrder.status).toBe('created')
      expect(workOrder.id).toBe(mockWorkOrderId)
      expect(workOrder.title).toBe('Monthly PM - Line 1')
    })

    it('Given create + submit + approve + start events, When folding, Then should produce started work order', () => {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))
      const t2 = DateTime.add(t0, Duration.minutes(10))
      const t3 = DateTime.add(t0, Duration.minutes(15))

      const events = [
        { _tag: 'WorkOrderCreated' as const, ...makeWorkOrderCreatedPayload({ occurredAt: t0 }) },
        { _tag: 'WorkOrderSubmitted' as const, ...makeWorkOrderSubmittedPayload({ occurredAt: t1 }) },
        { _tag: 'WorkOrderApproved' as const, ...makeWorkOrderApprovedPayload({ occurredAt: t2 }) },
        { _tag: 'WorkOrderStarted' as const, ...makeWorkOrderStartedPayload({ occurredAt: t3 }) },
      ]

      const workOrder = foldWorkOrderEvents(events, mockWorkOrderId)

      expect(workOrder.status).toBe('started')
      expect(Option.isSome(workOrder.actualStart)).toBe(true)
      expect(Option.isSome(workOrder.assignedTo)).toBe(true)
    })

    it('Given full lifecycle, When folding, Then should produce closed work order', () => {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))
      const t2 = DateTime.add(t0, Duration.minutes(10))
      const t3 = DateTime.add(t0, Duration.minutes(15))
      const t4 = DateTime.add(t0, Duration.minutes(120))
      const t5 = DateTime.add(t0, Duration.minutes(125))

      const events = [
        { _tag: 'WorkOrderCreated' as const, ...makeWorkOrderCreatedPayload({ occurredAt: t0 }) },
        { _tag: 'WorkOrderSubmitted' as const, ...makeWorkOrderSubmittedPayload({ occurredAt: t1 }) },
        { _tag: 'WorkOrderApproved' as const, ...makeWorkOrderApprovedPayload({ occurredAt: t2 }) },
        { _tag: 'WorkOrderStarted' as const, ...makeWorkOrderStartedPayload({ occurredAt: t3 }) },
        { _tag: 'WorkOrderCompleted' as const, ...makeWorkOrderCompletedPayload({ occurredAt: t4 }) },
        { _tag: 'WorkOrderClosed' as const, ...makeWorkOrderClosedPayload({ occurredAt: t5 }) },
      ]

      const workOrder = foldWorkOrderEvents(events, mockWorkOrderId)

      expect(workOrder.status).toBe('closed')
      expect(Option.isSome(workOrder.actualEnd)).toBe(true)
      expect(Option.isSome(workOrder.finalStatus)).toBe(true)
    })

    it('Given empty events, When folding, Then should throw', () => {
      expect(() => foldWorkOrderEvents([], mockWorkOrderId)).toThrow()
    })

    it('Given events not starting with WorkOrderCreated, When folding, Then should throw', () => {
      const events = [
        { _tag: 'WorkOrderSubmitted' as const, ...makeWorkOrderSubmittedPayload() },
      ]

      expect(() => foldWorkOrderEvents(events as any, mockWorkOrderId)).toThrow('First event must be WorkOrderCreated')
    })
  })
})
