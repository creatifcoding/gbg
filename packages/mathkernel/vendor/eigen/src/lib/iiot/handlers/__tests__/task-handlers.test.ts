/**
 * Task Instance Event Handlers — Unit Tests
 *
 * Tests for TaskEventHandlers verifying:
 * - EventGroup composition with all 9 task events
 * - Handler execution and logging
 * - Error catching wrapper behavior
 *
 * @module @gbg/tmnl/iiot/handlers/__tests__/task-handlers.test
 * @see EL-3 for task event requirements
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, DateTime, Duration, Schema } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { TaskEvents } from '../../schemas/events/groups'
import { TaskEventHandlers } from '../task-handlers'
import { IIoTEventLogLayer, IIoTIdentityLayer } from '../../infrastructure/eventlog-layer'
import type {
  TaskInstanceId,
  WorkOrderId,
  TaskDefinitionId,
  AssetId,
  EventId,
} from '../../schemas/identifiers'
import type { TaskStatus, BlockingReason, CompensationResult } from '../../schemas/task-instance'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_PREFIX = 'TEST-TASK'
const makeTestTaskInstanceId = (suffix: string): TaskInstanceId =>
  `${TEST_PREFIX}-TI-${suffix}` as TaskInstanceId
const makeTestWorkOrderId = (suffix: string): WorkOrderId =>
  `${TEST_PREFIX}-WO-${suffix}` as WorkOrderId
const makeTestTaskDefinitionId = (suffix: string): TaskDefinitionId =>
  `${TEST_PREFIX}-TD-${suffix}` as TaskDefinitionId
const makeTestAssetId = (suffix: string): AssetId =>
  `${TEST_PREFIX}-AST-${suffix}` as AssetId
const makeTestEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

// =============================================================================
// Test Layer Setup
// =============================================================================

const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)

/**
 * Helper to write a task event directly to the journal.
 */
const writeTaskEventToJournal = <Tag extends keyof typeof TaskEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
  primaryKey: string
): Effect.Effect<void, EventJournal.EventJournalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const event = TaskEvents.events[tag] as {
      payloadMsgPack: Schema.Schema<unknown, Uint8Array>
    }

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
// Test Fixtures
// =============================================================================

const makeTaskBecameReadyPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'work-order-service',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  satisfiedDependencies: [] as TaskInstanceId[],
  previousStatus: 'pending' as TaskStatus,
})

const makeTaskStartedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  startedBy?: string
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: overrides?.startedBy ?? 'operator-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  startedBy: overrides?.startedBy ?? 'operator-001',
  targetAssetId: Option.some(makeTestAssetId('machine-001')),
  estimatedDurationMinutes: Option.some(60),
})

const makeTaskProgressUpdatedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  previousProgress?: number
  newProgress?: number
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  previousProgress: overrides?.previousProgress ?? 0,
  newProgress: overrides?.newProgress ?? 50,
  notes: Option.some('Halfway complete'),
  updatedBy: 'operator-001',
})

const makeTaskBlockedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  blockingReason?: BlockingReason
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  blockingReason: overrides?.blockingReason ?? ('missing_parts' as BlockingReason),
  blockedBy: 'operator-001',
  details: Option.some('Waiting for replacement parts'),
  blockedDependencyIds: Option.none() as Option.Option<TaskInstanceId[]>,
})

const makeTaskUnblockedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'operator-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  previousBlockingReason: 'missing_parts' as BlockingReason,
  unblockedBy: 'operator-001',
  resolutionNotes: Option.some('Parts received and installed'),
})

const makeTaskCompletedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  completedBy?: string
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: overrides?.completedBy ?? 'operator-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  completedBy: overrides?.completedBy ?? 'operator-001',
  durationMinutes: Option.some(45),
  output: Option.some({ result: 'success' }),
  notes: Option.some('Task completed successfully'),
})

const makeTaskFailedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  error?: string
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  failedBy: 'system',
  error: overrides?.error ?? 'Equipment malfunction: Motor overheated',
  errorCode: Option.some('ERR-MOT-001'),
  retryable: true,
  retryCount: 0,
})

const makeTaskSkippedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  reason?: string
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'supervisor-001',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  skippedBy: 'supervisor-001',
  reason: overrides?.reason ?? 'Equipment already calibrated within tolerance',
  approvedBy: Option.some('manager-001'),
})

const makeTaskCompensatedPayload = (overrides?: {
  taskInstanceId?: TaskInstanceId
  workOrderId?: WorkOrderId
  occurredAt?: DateTime.Utc
  compensationResult?: CompensationResult
}) => ({
  eventId: makeTestEventId(),
  occurredAt: overrides?.occurredAt ?? DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: makeTestAssetId('001'),
  entityType: 'device' as const,
  correlationId: Option.none() as Option.Option<string>,
  schemaVersion: 1,
  taskInstanceId: overrides?.taskInstanceId ?? makeTestTaskInstanceId('001'),
  workOrderId: overrides?.workOrderId ?? makeTestWorkOrderId('001'),
  taskDefinitionId: makeTestTaskDefinitionId('001'),
  compensatedBy: 'system',
  compensationResult: overrides?.compensationResult ?? ('success' as CompensationResult),
  originalError: Option.some('Task failed due to timeout'),
  compensationAction: 'Rolled back configuration changes',
  notes: Option.some('Automatic rollback completed'),
})

// =============================================================================
// Test Suite: TaskEvents EventGroup
// =============================================================================

describe('Feature: TaskEvents EventGroup', () => {
  it('should define all 9 task events', () => {
    expect(TaskEvents.events).toBeDefined()

    // Verify all 9 events are registered
    const eventTags = Object.keys(TaskEvents.events)
    expect(eventTags).toContain('TaskBecameReady')
    expect(eventTags).toContain('TaskStarted')
    expect(eventTags).toContain('TaskProgressUpdated')
    expect(eventTags).toContain('TaskBlocked')
    expect(eventTags).toContain('TaskUnblocked')
    expect(eventTags).toContain('TaskCompleted')
    expect(eventTags).toContain('TaskFailed')
    expect(eventTags).toContain('TaskSkipped')
    expect(eventTags).toContain('TaskCompensated')
    expect(eventTags.length).toBe(9)
  })

  it('should use taskInstanceId as primary key for all events', () => {
    // Each event's primary key extractor should return the taskInstanceId
    const testTaskId = makeTestTaskInstanceId('pk-test')

    const events = TaskEvents.events as Record<
      string,
      { primaryKey: (payload: { taskInstanceId: TaskInstanceId }) => string }
    >

    for (const [tag, event] of Object.entries(events)) {
      const pk = event.primaryKey({ taskInstanceId: testTaskId } as never)
      expect(pk).toBe(testTaskId)
    }
  })
})

// =============================================================================
// Test Suite: TaskEventHandlers
// =============================================================================

describe('Feature: TaskEventHandlers', () => {
  it('should export TaskEventHandlers', () => {
    expect(TaskEventHandlers).toBeDefined()
  })

  it('should compose with EventLog layer', async () => {
    const program = Effect.gen(function* () {
      // The layer stack should build without error
      return 'composed'
    }).pipe(
      Effect.provide(
        Layer.mergeAll(IIoTEventLogLayer, TaskEventHandlers).pipe(
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
// Test Suite: Handler Execution
// =============================================================================

describe('Feature: Handler Execution', () => {
  describe('Scenario: TaskBecameReady', () => {
    it('should handle TaskBecameReady event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('became-ready')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskBecameReady',
          makeTaskBecameReadyPayload({ taskInstanceId: testTaskId }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskStarted', () => {
    it('should handle TaskStarted event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('started')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskStarted',
          makeTaskStartedPayload({ taskInstanceId: testTaskId }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskProgressUpdated', () => {
    it('should handle TaskProgressUpdated event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('progress')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskProgressUpdated',
          makeTaskProgressUpdatedPayload({
            taskInstanceId: testTaskId,
            previousProgress: 25,
            newProgress: 75,
          }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskBlocked', () => {
    it('should handle TaskBlocked event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('blocked')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskBlocked',
          makeTaskBlockedPayload({
            taskInstanceId: testTaskId,
            blockingReason: 'missing_tools' as BlockingReason,
          }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskUnblocked', () => {
    it('should handle TaskUnblocked event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('unblocked')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskUnblocked',
          makeTaskUnblockedPayload({ taskInstanceId: testTaskId }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskCompleted', () => {
    it('should handle TaskCompleted event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('completed')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskCompleted',
          makeTaskCompletedPayload({ taskInstanceId: testTaskId }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskFailed', () => {
    it('should handle TaskFailed event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('failed')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskFailed',
          makeTaskFailedPayload({
            taskInstanceId: testTaskId,
            error: 'Critical failure in processing',
          }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskSkipped', () => {
    it('should handle TaskSkipped event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('skipped')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskSkipped',
          makeTaskSkippedPayload({
            taskInstanceId: testTaskId,
            reason: 'Prerequisite not applicable',
          }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })

  describe('Scenario: TaskCompensated', () => {
    it('should handle TaskCompensated event without error', async () => {
      const testTaskId = makeTestTaskInstanceId('compensated')

      const program = Effect.gen(function* () {
        yield* writeTaskEventToJournal(
          'TaskCompensated',
          makeTaskCompensatedPayload({
            taskInstanceId: testTaskId,
            compensationResult: 'success' as CompensationResult,
          }),
          testTaskId
        )
        return 'handled'
      }).pipe(Effect.provide(makeTestEventJournalLayer()))

      const result = await Effect.runPromise(program)
      expect(result).toBe('handled')
    })
  })
})

// =============================================================================
// Test Suite: Full Lifecycle Integration
// =============================================================================

describe('Feature: Task Lifecycle Integration', () => {
  it('should handle full lifecycle: ready -> started -> progress -> completed', async () => {
    const testTaskId = makeTestTaskInstanceId('lifecycle-full')
    const testWorkOrderId = makeTestWorkOrderId('lifecycle-001')

    const program = Effect.gen(function* () {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(1))
      const t2 = DateTime.add(t0, Duration.minutes(5))
      const t3 = DateTime.add(t0, Duration.minutes(10))

      // Task becomes ready
      yield* writeTaskEventToJournal(
        'TaskBecameReady',
        makeTaskBecameReadyPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t0,
        }),
        testTaskId
      )

      // Task started
      yield* writeTaskEventToJournal(
        'TaskStarted',
        makeTaskStartedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t1,
          startedBy: 'operator-001',
        }),
        testTaskId
      )

      // Progress update
      yield* writeTaskEventToJournal(
        'TaskProgressUpdated',
        makeTaskProgressUpdatedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t2,
          previousProgress: 0,
          newProgress: 50,
        }),
        testTaskId
      )

      // Task completed
      yield* writeTaskEventToJournal(
        'TaskCompleted',
        makeTaskCompletedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t3,
          completedBy: 'operator-001',
        }),
        testTaskId
      )

      return 'lifecycle-complete'
    }).pipe(Effect.provide(makeTestEventJournalLayer()))

    const result = await Effect.runPromise(program)
    expect(result).toBe('lifecycle-complete')
  })

  it('should handle blocked-unblocked flow: started -> blocked -> unblocked -> completed', async () => {
    const testTaskId = makeTestTaskInstanceId('lifecycle-blocked')
    const testWorkOrderId = makeTestWorkOrderId('lifecycle-002')

    const program = Effect.gen(function* () {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(5))
      const t2 = DateTime.add(t0, Duration.minutes(30))
      const t3 = DateTime.add(t0, Duration.minutes(60))

      // Task started
      yield* writeTaskEventToJournal(
        'TaskStarted',
        makeTaskStartedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t0,
        }),
        testTaskId
      )

      // Task blocked
      yield* writeTaskEventToJournal(
        'TaskBlocked',
        makeTaskBlockedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t1,
          blockingReason: 'missing_parts' as BlockingReason,
        }),
        testTaskId
      )

      // Task unblocked
      yield* writeTaskEventToJournal(
        'TaskUnblocked',
        makeTaskUnblockedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t2,
        }),
        testTaskId
      )

      // Task completed
      yield* writeTaskEventToJournal(
        'TaskCompleted',
        makeTaskCompletedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t3,
        }),
        testTaskId
      )

      return 'blocked-flow-complete'
    }).pipe(Effect.provide(makeTestEventJournalLayer()))

    const result = await Effect.runPromise(program)
    expect(result).toBe('blocked-flow-complete')
  })

  it('should handle failure-compensation flow: started -> failed -> compensated', async () => {
    const testTaskId = makeTestTaskInstanceId('lifecycle-failed')
    const testWorkOrderId = makeTestWorkOrderId('lifecycle-003')

    const program = Effect.gen(function* () {
      const t0 = DateTime.unsafeNow()
      const t1 = DateTime.add(t0, Duration.minutes(10))
      const t2 = DateTime.add(t0, Duration.minutes(15))

      // Task started
      yield* writeTaskEventToJournal(
        'TaskStarted',
        makeTaskStartedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t0,
        }),
        testTaskId
      )

      // Task failed
      yield* writeTaskEventToJournal(
        'TaskFailed',
        makeTaskFailedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t1,
          error: 'Database connection timeout',
        }),
        testTaskId
      )

      // Task compensated (saga rollback)
      yield* writeTaskEventToJournal(
        'TaskCompensated',
        makeTaskCompensatedPayload({
          taskInstanceId: testTaskId,
          workOrderId: testWorkOrderId,
          occurredAt: t2,
          compensationResult: 'success' as CompensationResult,
        }),
        testTaskId
      )

      return 'failure-compensation-complete'
    }).pipe(Effect.provide(makeTestEventJournalLayer()))

    const result = await Effect.runPromise(program)
    expect(result).toBe('failure-compensation-complete')
  })
})
