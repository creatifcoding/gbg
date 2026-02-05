/**
 * Task Instance Events — Unit Tests
 *
 * Tests for 9 task lifecycle events:
 * 1. TaskBecameReady - Dependencies satisfied, can start
 * 2. TaskStarted - Execution began
 * 3. TaskProgressUpdated - Progress percentage updated
 * 4. TaskBlocked - Blocked by dependency/issue
 * 5. TaskUnblocked - Block resolved
 * 6. TaskCompleted - Successfully finished
 * 7. TaskFailed - Failed with error
 * 8. TaskSkipped - Intentionally skipped
 * 9. TaskCompensated - Compensating action executed
 *
 * Note: The _tag field is inherited from BaseOperationalEvent ('BaseOperationalEvent').
 * Event type discrimination happens via schema matching, not the instance _tag.
 *
 * @module
 * @see EL-3.9-12 for task event requirements
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'
import {
  // Branded Types
  TaskDefinitionId,

  // Events
  TaskBecameReady,
  TaskStarted,
  TaskProgressUpdated,
  TaskBlocked,
  TaskUnblocked,
  TaskCompleted,
  TaskFailed,
  TaskSkipped,
  TaskCompensated,

  // Union and Constants
  TASK_EVENT_TAGS,
  type TaskEvent,
  type TaskEventTag,
} from '../task-events'
import { TaskInstanceId, WorkOrderId, AssetId, EventId } from '../../../identifiers'
import { TaskStatus, BlockingReason, CompensationResult } from '../../../task-instance'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockWorkOrderId = 'WO-2026-00001' as WorkOrderId
const mockTaskInstanceId = 'TASK-abc123' as TaskInstanceId
const mockTaskDefinitionId = 'TDEF-maintenance-step-1' as Schema.Schema.Type<typeof TaskDefinitionId>
const mockAssetId = 'MCH-001' as AssetId
const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const baseEventFields = {
  eventId: makeEventId(),
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: mockTaskInstanceId as unknown as AssetId,
  entityType: 'device' as const,
  correlationId: Option.none<string>(),
  schemaVersion: 1,
}

// =============================================================================
// Test: TaskDefinitionId Branded Type
// =============================================================================

describe('TaskDefinitionId Branded Type', () => {
  it('should create a branded TaskDefinitionId', () => {
    const decoded = Schema.decodeSync(TaskDefinitionId)('TDEF-maintenance-step-1')
    expect(decoded).toBe('TDEF-maintenance-step-1')
  })

  it('should have proper brand', () => {
    const decoded = Schema.decodeSync(TaskDefinitionId)('TDEF-test')
    // Type check - TypeScript ensures this has the brand
    const _typeCheck: Schema.Schema.Type<typeof TaskDefinitionId> = decoded
    expect(typeof decoded).toBe('string')
  })
})

// =============================================================================
// Test: TaskBecameReady Event
// =============================================================================

describe('TaskBecameReady Event', () => {
  it('should create a valid TaskBecameReady event with correct fields', () => {
    const event = new TaskBecameReady({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      satisfiedDependencies: [
        'TASK-dep-001' as TaskInstanceId,
        'TASK-dep-002' as TaskInstanceId,
      ],
      previousStatus: 'pending',
    })

    // Test event-specific fields (not _tag which is inherited from base)
    expect(event.taskInstanceId).toBe(mockTaskInstanceId)
    expect(event.workOrderId).toBe(mockWorkOrderId)
    expect(event.taskDefinitionId).toBe(mockTaskDefinitionId)
    expect(event.satisfiedDependencies).toHaveLength(2)
    expect(event.previousStatus).toBe('pending')
  })

  it('should encode and decode correctly', () => {
    const event = new TaskBecameReady({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      satisfiedDependencies: [],
      previousStatus: 'pending',
    })

    const encoded = Schema.encodeSync(TaskBecameReady)(event)
    const decoded = Schema.decodeSync(TaskBecameReady)(encoded)

    expect(decoded.taskInstanceId).toBe(mockTaskInstanceId)
    expect(decoded.workOrderId).toBe(mockWorkOrderId)
    expect(decoded.previousStatus).toBe('pending')
  })
})

// =============================================================================
// Test: TaskStarted Event
// =============================================================================

describe('TaskStarted Event', () => {
  it('should create a valid TaskStarted event with correct fields', () => {
    const event = new TaskStarted({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      startedBy: 'operator-001',
      targetAssetId: Option.some(mockAssetId),
      estimatedDurationMinutes: Option.some(60),
    })

    expect(event.taskInstanceId).toBe(mockTaskInstanceId)
    expect(event.startedBy).toBe('operator-001')
    expect(Option.isSome(event.targetAssetId)).toBe(true)
    expect(Option.getOrElse(event.estimatedDurationMinutes, () => 0)).toBe(60)
  })

  it('should allow optional fields to be none', () => {
    const event = new TaskStarted({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      startedBy: 'system',
      targetAssetId: Option.none(),
      estimatedDurationMinutes: Option.none(),
    })

    expect(Option.isNone(event.targetAssetId)).toBe(true)
    expect(Option.isNone(event.estimatedDurationMinutes)).toBe(true)
  })
})

// =============================================================================
// Test: TaskProgressUpdated Event
// =============================================================================

describe('TaskProgressUpdated Event', () => {
  it('should create a valid TaskProgressUpdated event with progress 0-100', () => {
    const event = new TaskProgressUpdated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      previousProgress: 25,
      newProgress: 50,
      notes: Option.some('Halfway complete'),
      updatedBy: 'operator-001',
    })

    expect(event.previousProgress).toBe(25)
    expect(event.newProgress).toBe(50)
    expect(Option.getOrElse(event.notes, () => '')).toBe('Halfway complete')
    expect(event.updatedBy).toBe('operator-001')
  })

  it('should accept progress at boundaries (0 and 100)', () => {
    const eventStart = new TaskProgressUpdated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      previousProgress: 0,
      newProgress: 0,
      notes: Option.none(),
      updatedBy: 'system',
    })

    const eventEnd = new TaskProgressUpdated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      previousProgress: 99,
      newProgress: 100,
      notes: Option.some('Task finished'),
      updatedBy: 'system',
    })

    expect(eventStart.newProgress).toBe(0)
    expect(eventEnd.newProgress).toBe(100)
  })
})

// =============================================================================
// Test: TaskBlocked Event
// =============================================================================

describe('TaskBlocked Event', () => {
  it('should create a valid TaskBlocked event with blocking reason', () => {
    const event = new TaskBlocked({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      blockingReason: 'missing_parts',
      blockedBy: 'operator-001',
      details: Option.some('Waiting for replacement filter'),
      blockedDependencyIds: Option.none(),
    })

    expect(event.blockingReason).toBe('missing_parts')
    expect(event.blockedBy).toBe('operator-001')
    expect(Option.getOrElse(event.details, () => '')).toBe('Waiting for replacement filter')
  })

  it('should support blocking by predecessor failure', () => {
    const event = new TaskBlocked({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      blockingReason: 'predecessor_failed',
      blockedBy: 'system',
      details: Option.some('Predecessor TASK-dep-001 failed'),
      blockedDependencyIds: Option.some(['TASK-dep-001' as TaskInstanceId]),
    })

    expect(event.blockingReason).toBe('predecessor_failed')
    expect(Option.isSome(event.blockedDependencyIds)).toBe(true)
  })
})

// =============================================================================
// Test: TaskUnblocked Event
// =============================================================================

describe('TaskUnblocked Event', () => {
  it('should create a valid TaskUnblocked event', () => {
    const event = new TaskUnblocked({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      previousBlockingReason: 'missing_parts',
      unblockedBy: 'operator-001',
      resolutionNotes: Option.some('Parts received and installed'),
    })

    expect(event.previousBlockingReason).toBe('missing_parts')
    expect(event.unblockedBy).toBe('operator-001')
    expect(Option.getOrElse(event.resolutionNotes, () => '')).toBe('Parts received and installed')
  })
})

// =============================================================================
// Test: TaskCompleted Event
// =============================================================================

describe('TaskCompleted Event', () => {
  it('should create a valid TaskCompleted event', () => {
    const event = new TaskCompleted({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      completedBy: 'operator-001',
      durationMinutes: Option.some(45),
      output: Option.some({ result: 'success', readings: [1.2, 1.3, 1.4] }),
      notes: Option.some('Task completed successfully'),
    })

    expect(event.completedBy).toBe('operator-001')
    expect(Option.getOrElse(event.durationMinutes, () => 0)).toBe(45)
    expect(Option.isSome(event.output)).toBe(true)
    expect(Option.isSome(event.notes)).toBe(true)
  })
})

// =============================================================================
// Test: TaskFailed Event
// =============================================================================

describe('TaskFailed Event', () => {
  it('should create a valid TaskFailed event with error details', () => {
    const event = new TaskFailed({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      failedBy: 'system',
      error: 'Equipment malfunction: Motor overheated',
      errorCode: Option.some('ERR-MOT-001'),
      retryable: true,
      retryCount: 0,
    })

    expect(event.error).toBe('Equipment malfunction: Motor overheated')
    expect(event.retryable).toBe(true)
    expect(Option.isSome(event.errorCode)).toBe(true)
    expect(event.retryCount).toBe(0)
  })

  it('should support non-retryable failures', () => {
    const event = new TaskFailed({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      failedBy: 'operator-001',
      error: 'Safety violation detected',
      errorCode: Option.some('ERR-SAFETY-001'),
      retryable: false,
      retryCount: 0,
    })

    expect(event.retryable).toBe(false)
  })
})

// =============================================================================
// Test: TaskSkipped Event
// =============================================================================

describe('TaskSkipped Event', () => {
  it('should create a valid TaskSkipped event', () => {
    const event = new TaskSkipped({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      skippedBy: 'supervisor-001',
      reason: 'Equipment already calibrated within tolerance',
      approvedBy: Option.some('manager-001'),
    })

    expect(event.skippedBy).toBe('supervisor-001')
    expect(event.reason).toBe('Equipment already calibrated within tolerance')
    expect(Option.getOrElse(event.approvedBy, () => '')).toBe('manager-001')
  })
})

// =============================================================================
// Test: TaskCompensated Event
// =============================================================================

describe('TaskCompensated Event', () => {
  it('should create a valid TaskCompensated event with success result', () => {
    const event = new TaskCompensated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      compensatedBy: 'system',
      compensationResult: 'success',
      originalError: Option.some('Task failed due to timeout'),
      compensationAction: 'Rolled back configuration changes',
      notes: Option.some('Automatic rollback completed'),
    })

    expect(event.compensationResult).toBe('success')
    expect(event.compensationAction).toBe('Rolled back configuration changes')
    expect(event.compensatedBy).toBe('system')
  })

  it('should support partial compensation', () => {
    const event = new TaskCompensated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      compensatedBy: 'operator-001',
      compensationResult: 'partial',
      originalError: Option.some('Network disconnection'),
      compensationAction: 'Reverted local changes only',
      notes: Option.some('Remote changes require manual intervention'),
    })

    expect(event.compensationResult).toBe('partial')
  })
})

// =============================================================================
// Test: TASK_EVENT_TAGS Constant
// =============================================================================

describe('TASK_EVENT_TAGS', () => {
  it('should contain all 9 task event tags', () => {
    expect(TASK_EVENT_TAGS).toHaveLength(9)
    expect(TASK_EVENT_TAGS).toContain('TaskBecameReady')
    expect(TASK_EVENT_TAGS).toContain('TaskStarted')
    expect(TASK_EVENT_TAGS).toContain('TaskProgressUpdated')
    expect(TASK_EVENT_TAGS).toContain('TaskBlocked')
    expect(TASK_EVENT_TAGS).toContain('TaskUnblocked')
    expect(TASK_EVENT_TAGS).toContain('TaskCompleted')
    expect(TASK_EVENT_TAGS).toContain('TaskFailed')
    expect(TASK_EVENT_TAGS).toContain('TaskSkipped')
    expect(TASK_EVENT_TAGS).toContain('TaskCompensated')
  })
})

// =============================================================================
// Test: TaskEvent Union Type
// =============================================================================

describe('TaskEvent Union Type', () => {
  it('should allow all task event types in union', () => {
    // Type-level test - these should compile without error
    const events: TaskEvent[] = [
      new TaskBecameReady({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        taskDefinitionId: mockTaskDefinitionId,
        satisfiedDependencies: [],
        previousStatus: 'pending',
      }),
      new TaskStarted({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        taskDefinitionId: mockTaskDefinitionId,
        startedBy: 'operator',
        targetAssetId: Option.none(),
        estimatedDurationMinutes: Option.none(),
      }),
    ]

    expect(events).toHaveLength(2)
    // Both should have taskInstanceId (common field)
    expect(events[0].taskInstanceId).toBe(mockTaskInstanceId)
    expect(events[1].taskInstanceId).toBe(mockTaskInstanceId)
  })
})

// =============================================================================
// Test: Schema Encoding/Decoding Round-Trip
// =============================================================================

describe('Schema Round-Trip', () => {
  it('should encode and decode all event types correctly', () => {
    // Create events
    const becameReady = new TaskBecameReady({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      satisfiedDependencies: [],
      previousStatus: 'pending',
    })

    const completed = new TaskCompleted({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      completedBy: 'operator',
      durationMinutes: Option.some(30),
      output: Option.none(),
      notes: Option.none(),
    })

    const compensated = new TaskCompensated({
      ...baseEventFields,
      taskInstanceId: mockTaskInstanceId,
      workOrderId: mockWorkOrderId,
      taskDefinitionId: mockTaskDefinitionId,
      compensatedBy: 'system',
      compensationResult: 'success',
      originalError: Option.none(),
      compensationAction: 'rollback',
      notes: Option.none(),
    })

    // Verify each has distinguishing fields
    expect(becameReady.previousStatus).toBe('pending')
    expect(completed.completedBy).toBe('operator')
    expect(compensated.compensationResult).toBe('success')

    // Verify round-trip
    const encodedBecameReady = Schema.encodeSync(TaskBecameReady)(becameReady)
    const decodedBecameReady = Schema.decodeSync(TaskBecameReady)(encodedBecameReady)
    expect(decodedBecameReady.previousStatus).toBe('pending')

    const encodedCompleted = Schema.encodeSync(TaskCompleted)(completed)
    const decodedCompleted = Schema.decodeSync(TaskCompleted)(encodedCompleted)
    expect(decodedCompleted.completedBy).toBe('operator')

    const encodedCompensated = Schema.encodeSync(TaskCompensated)(compensated)
    const decodedCompensated = Schema.decodeSync(TaskCompensated)(encodedCompensated)
    expect(decodedCompensated.compensationResult).toBe('success')
  })
})

// =============================================================================
// Test: Schema Validation
// =============================================================================

describe('Schema Validation', () => {
  it('should reject invalid progress values', () => {
    expect(() => {
      new TaskProgressUpdated({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        previousProgress: -1, // Invalid: below 0
        newProgress: 50,
        notes: Option.none(),
        updatedBy: 'system',
      })
    }).toThrow()

    expect(() => {
      new TaskProgressUpdated({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        previousProgress: 50,
        newProgress: 101, // Invalid: above 100
        notes: Option.none(),
        updatedBy: 'system',
      })
    }).toThrow()
  })

  it('should reject empty error message in TaskFailed', () => {
    expect(() => {
      new TaskFailed({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        taskDefinitionId: mockTaskDefinitionId,
        failedBy: 'system',
        error: '', // Invalid: empty string for NonEmptyString
        errorCode: Option.none(),
        retryable: true,
        retryCount: 0,
      })
    }).toThrow()
  })

  it('should reject negative retryCount in TaskFailed', () => {
    expect(() => {
      new TaskFailed({
        ...baseEventFields,
        taskInstanceId: mockTaskInstanceId,
        workOrderId: mockWorkOrderId,
        taskDefinitionId: mockTaskDefinitionId,
        failedBy: 'system',
        error: 'Some error',
        errorCode: Option.none(),
        retryable: true,
        retryCount: -1, // Invalid: negative
      })
    }).toThrow()
  })
})
