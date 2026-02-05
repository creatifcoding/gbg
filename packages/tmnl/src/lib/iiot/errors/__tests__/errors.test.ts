/**
 * IIoT Error Schemas Tests
 *
 * Tests for Data.TaggedError patterns:
 * - Tag discrimination
 * - Field access
 * - Union type inference
 * - Pattern matching with Effect.catchTag
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Data, Effect, Match } from 'effect'

// Common Errors
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../common'

// Asset Errors
import {
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  type AssetCommandError,
} from '../asset'

// Alarm Errors
import {
  AlarmNotFoundError,
  InvalidAlarmTransitionError,
  AlarmAlreadyAcknowledgedError,
  type AlarmCommandError,
} from '../alarm'

// Work Order Errors
import {
  WorkOrderNotFoundError,
  InvalidWorkOrderStateError,
  WorkOrderApprovalRequiredError,
  type WorkOrderCommandError,
} from '../work-order'

// Equipment State Errors
import {
  EquipmentStateNotFoundError,
  InvalidStateTransitionError,
  type EquipmentStateCommandError,
} from '../equipment-state'

// ─────────────────────────────────────────────────────────────────────────────
// Common Errors Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Common Errors', () => {
  describe('ValidationError', () => {
    it('should have correct tag', () => {
      const error = new ValidationError({
        field: 'name',
        message: 'Name is required',
      })
      expect(error._tag).toBe('ValidationError')
    })

    it('should store field and message', () => {
      const error = new ValidationError({
        field: 'email',
        message: 'Invalid email format',
        value: 'not-an-email',
      })
      expect(error.field).toBe('email')
      expect(error.message).toBe('Invalid email format')
      expect(error.value).toBe('not-an-email')
    })

    it('should allow optional value', () => {
      const error = new ValidationError({
        field: 'age',
        message: 'Must be positive',
      })
      expect(error.value).toBeUndefined()
    })
  })

  describe('NotFoundError', () => {
    it('should have correct tag', () => {
      const error = new NotFoundError({
        entityType: 'User',
        entityId: 'usr-123',
      })
      expect(error._tag).toBe('NotFoundError')
    })

    it('should store entity info', () => {
      const error = new NotFoundError({
        entityType: 'Asset',
        entityId: 'asset-456',
      })
      expect(error.entityType).toBe('Asset')
      expect(error.entityId).toBe('asset-456')
    })
  })

  describe('ConflictError', () => {
    it('should have correct tag', () => {
      const error = new ConflictError({
        entityType: 'Order',
        entityId: 'ord-789',
        expectedVersion: 1,
        actualVersion: 2,
      })
      expect(error._tag).toBe('ConflictError')
    })

    it('should track version mismatch', () => {
      const error = new ConflictError({
        entityType: 'Order',
        entityId: 'ord-789',
        expectedVersion: 5,
        actualVersion: 7,
      })
      expect(error.expectedVersion).toBe(5)
      expect(error.actualVersion).toBe(7)
    })
  })

  describe('UnauthorizedError', () => {
    it('should have correct tag', () => {
      const error = new UnauthorizedError({
        operation: 'deleteAlarm',
      })
      expect(error._tag).toBe('UnauthorizedError')
    })

    it('should store operation and optional reason', () => {
      const error = new UnauthorizedError({
        operation: 'acknowledgeAlarm',
        reason: 'Insufficient permissions',
      })
      expect(error.operation).toBe('acknowledgeAlarm')
      expect(error.reason).toBe('Insufficient permissions')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Asset Errors Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Errors', () => {
  describe('AssetNotFoundError', () => {
    it('should have correct tag', () => {
      const error = new AssetNotFoundError({
        assetId: 'ASSET-001',
      })
      expect(error._tag).toBe('AssetNotFoundError')
    })

    it('should store asset type when provided', () => {
      const error = new AssetNotFoundError({
        assetId: 'MCH-001',
        assetType: 'machine',
      })
      expect(error.assetId).toBe('MCH-001')
      expect(error.assetType).toBe('machine')
    })
  })

  describe('AssetValidationError', () => {
    it('should have correct tag', () => {
      const error = new AssetValidationError({
        assetId: 'ASSET-002',
        field: 'status',
        message: 'Invalid status value',
      })
      expect(error._tag).toBe('AssetValidationError')
    })

    it('should store all fields', () => {
      const error = new AssetValidationError({
        assetId: 'SNS-001',
        field: 'threshold',
        message: 'Threshold must be positive',
      })
      expect(error.assetId).toBe('SNS-001')
      expect(error.field).toBe('threshold')
      expect(error.message).toBe('Threshold must be positive')
    })
  })

  describe('AssetConflictError', () => {
    it('should have correct tag', () => {
      const error = new AssetConflictError({
        assetId: 'ASSET-003',
        expectedVersion: 1,
        actualVersion: 2,
      })
      expect(error._tag).toBe('AssetConflictError')
    })

    it('should track version conflict', () => {
      const error = new AssetConflictError({
        assetId: 'MCH-002',
        expectedVersion: 10,
        actualVersion: 15,
      })
      expect(error.assetId).toBe('MCH-002')
      expect(error.expectedVersion).toBe(10)
      expect(error.actualVersion).toBe(15)
    })
  })

  describe('AssetCommandError union', () => {
    it('should discriminate asset errors via catchTag', async () => {
      const handleAssetError = (error: AssetCommandError): string =>
        Match.value(error).pipe(
          Match.tag('AssetNotFoundError', (e) => `Not found: ${e.assetId}`),
          Match.tag('AssetValidationError', (e) => `Invalid ${e.field}: ${e.message}`),
          Match.tag('AssetConflictError', (e) => `Version conflict: ${e.expectedVersion} vs ${e.actualVersion}`),
          Match.exhaustive
        )

      const notFound = new AssetNotFoundError({ assetId: 'X' })
      expect(handleAssetError(notFound)).toBe('Not found: X')

      const validation = new AssetValidationError({
        assetId: 'Y',
        field: 'name',
        message: 'Required',
      })
      expect(handleAssetError(validation)).toBe('Invalid name: Required')

      const conflict = new AssetConflictError({
        assetId: 'Z',
        expectedVersion: 1,
        actualVersion: 2,
      })
      expect(handleAssetError(conflict)).toBe('Version conflict: 1 vs 2')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Alarm Errors Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Alarm Errors', () => {
  describe('AlarmNotFoundError', () => {
    it('should have correct tag', () => {
      const error = new AlarmNotFoundError({
        alarmId: 'ALM-001',
      })
      expect(error._tag).toBe('AlarmNotFoundError')
    })
  })

  describe('InvalidAlarmTransitionError', () => {
    it('should have correct tag', () => {
      const error = new InvalidAlarmTransitionError({
        alarmId: 'ALM-002',
        currentState: 'active',
        attemptedState: 'active',
        reason: 'Alarm is already active',
      })
      expect(error._tag).toBe('InvalidAlarmTransitionError')
    })

    it('should store transition details', () => {
      const error = new InvalidAlarmTransitionError({
        alarmId: 'ALM-003',
        currentState: 'cleared',
        attemptedState: 'acknowledged',
        reason: 'Cannot acknowledge a cleared alarm',
      })
      expect(error.alarmId).toBe('ALM-003')
      expect(error.currentState).toBe('cleared')
      expect(error.attemptedState).toBe('acknowledged')
      expect(error.reason).toBe('Cannot acknowledge a cleared alarm')
    })
  })

  describe('AlarmAlreadyAcknowledgedError', () => {
    it('should have correct tag', () => {
      const now = new Date()
      const error = new AlarmAlreadyAcknowledgedError({
        alarmId: 'ALM-004',
        acknowledgedAt: now,
        acknowledgedBy: 'user-123',
      })
      expect(error._tag).toBe('AlarmAlreadyAcknowledgedError')
    })

    it('should store acknowledgment details', () => {
      const ackTime = new Date('2026-01-31T12:00:00Z')
      const error = new AlarmAlreadyAcknowledgedError({
        alarmId: 'ALM-005',
        acknowledgedAt: ackTime,
        acknowledgedBy: 'operator-456',
      })
      expect(error.alarmId).toBe('ALM-005')
      expect(error.acknowledgedAt).toEqual(ackTime)
      expect(error.acknowledgedBy).toBe('operator-456')
    })
  })

  describe('AlarmCommandError union', () => {
    it('should discriminate alarm errors', () => {
      const handleAlarmError = (error: AlarmCommandError): string =>
        Match.value(error).pipe(
          Match.tag('AlarmNotFoundError', (e) => `Alarm not found: ${e.alarmId}`),
          Match.tag('InvalidAlarmTransitionError', (e) => `Invalid transition: ${e.currentState} -> ${e.attemptedState}`),
          Match.tag('AlarmAlreadyAcknowledgedError', (e) => `Already acked by ${e.acknowledgedBy}`),
          Match.exhaustive
        )

      const notFound = new AlarmNotFoundError({ alarmId: 'A' })
      expect(handleAlarmError(notFound)).toBe('Alarm not found: A')

      const transition = new InvalidAlarmTransitionError({
        alarmId: 'B',
        currentState: 'idle',
        attemptedState: 'cleared',
        reason: 'Cannot clear idle alarm',
      })
      expect(handleAlarmError(transition)).toBe('Invalid transition: idle -> cleared')

      const acked = new AlarmAlreadyAcknowledgedError({
        alarmId: 'C',
        acknowledgedAt: new Date(),
        acknowledgedBy: 'bob',
      })
      expect(handleAlarmError(acked)).toBe('Already acked by bob')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Work Order Errors Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Work Order Errors', () => {
  describe('WorkOrderNotFoundError', () => {
    it('should have correct tag', () => {
      const error = new WorkOrderNotFoundError({
        workOrderId: 'WO-2026-00001',
      })
      expect(error._tag).toBe('WorkOrderNotFoundError')
    })
  })

  describe('InvalidWorkOrderStateError', () => {
    it('should have correct tag', () => {
      const error = new InvalidWorkOrderStateError({
        workOrderId: 'WO-2026-00002',
        currentState: 'completed',
        attemptedAction: 'start',
      })
      expect(error._tag).toBe('InvalidWorkOrderStateError')
    })

    it('should store state info', () => {
      const error = new InvalidWorkOrderStateError({
        workOrderId: 'WO-2026-00003',
        currentState: 'draft',
        attemptedAction: 'complete',
      })
      expect(error.workOrderId).toBe('WO-2026-00003')
      expect(error.currentState).toBe('draft')
      expect(error.attemptedAction).toBe('complete')
    })
  })

  describe('WorkOrderApprovalRequiredError', () => {
    it('should have correct tag', () => {
      const error = new WorkOrderApprovalRequiredError({
        workOrderId: 'WO-2026-00004',
        requiredApprovalType: 'safety',
      })
      expect(error._tag).toBe('WorkOrderApprovalRequiredError')
    })

    it('should store approval type', () => {
      const error = new WorkOrderApprovalRequiredError({
        workOrderId: 'WO-2026-00005',
        requiredApprovalType: 'supervisor',
      })
      expect(error.workOrderId).toBe('WO-2026-00005')
      expect(error.requiredApprovalType).toBe('supervisor')
    })
  })

  describe('WorkOrderCommandError union', () => {
    it('should discriminate work order errors', () => {
      const handleWOError = (error: WorkOrderCommandError): string =>
        Match.value(error).pipe(
          Match.tag('WorkOrderNotFoundError', (e) => `WO not found: ${e.workOrderId}`),
          Match.tag('InvalidWorkOrderStateError', (e) => `Cannot ${e.attemptedAction} in ${e.currentState}`),
          Match.tag('WorkOrderApprovalRequiredError', (e) => `Needs ${e.requiredApprovalType} approval`),
          Match.exhaustive
        )

      const notFound = new WorkOrderNotFoundError({ workOrderId: 'WO-X' })
      expect(handleWOError(notFound)).toBe('WO not found: WO-X')

      const invalidState = new InvalidWorkOrderStateError({
        workOrderId: 'WO-Y',
        currentState: 'cancelled',
        attemptedAction: 'resume',
      })
      expect(handleWOError(invalidState)).toBe('Cannot resume in cancelled')

      const approval = new WorkOrderApprovalRequiredError({
        workOrderId: 'WO-Z',
        requiredApprovalType: 'quality',
      })
      expect(handleWOError(approval)).toBe('Needs quality approval')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Equipment State Errors Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Equipment State Errors', () => {
  describe('EquipmentStateNotFoundError', () => {
    it('should have correct tag', () => {
      const error = new EquipmentStateNotFoundError({
        machineId: 'MCH-001',
      })
      expect(error._tag).toBe('EquipmentStateNotFoundError')
    })
  })

  describe('InvalidStateTransitionError', () => {
    it('should have correct tag', () => {
      const error = new InvalidStateTransitionError({
        machineId: 'MCH-002',
        currentState: 'running',
        targetState: 'starting',
        reason: 'Invalid transition',
      })
      expect(error._tag).toBe('InvalidStateTransitionError')
    })

    it('should store transition info', () => {
      const error = new InvalidStateTransitionError({
        machineId: 'MCH-003',
        currentState: 'faulted',
        targetState: 'operational',
        reason: 'Fault must be cleared first',
      })
      expect(error.machineId).toBe('MCH-003')
      expect(error.currentState).toBe('faulted')
      expect(error.targetState).toBe('operational')
      expect(error.reason).toBe('Fault must be cleared first')
    })
  })

  describe('EquipmentStateCommandError union', () => {
    it('should discriminate equipment errors', () => {
      const handleEquipError = (error: EquipmentStateCommandError): string =>
        Match.value(error).pipe(
          Match.tag('EquipmentStateNotFoundError', (e) => `Equipment not found: ${e.machineId}`),
          Match.tag('InvalidStateTransitionError', (e) => `Cannot transition ${e.currentState} -> ${e.targetState}`),
          Match.tag('EquipmentStateValidationError', (e) => `Validation failed: ${e.field}`),
          Match.tag('FaultNotFoundError', (e) => `Fault not found: ${e.faultCode}`),
          Match.tag('MaintenanceInProgressError', (e) => `Maintenance in progress: ${e.machineId}`),
          Match.exhaustive
        )

      const notFound = new EquipmentStateNotFoundError({ machineId: 'M1' })
      expect(handleEquipError(notFound)).toBe('Equipment not found: M1')

      const transition = new InvalidStateTransitionError({
        machineId: 'M2',
        currentState: 'stopped',
        targetState: 'faulted',
        reason: 'Invalid transition path',
      })
      expect(handleEquipError(transition)).toBe('Cannot transition stopped -> faulted')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Effect Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Effect Integration', () => {
  it('should work with Effect.catchTag', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.fail(new AssetNotFoundError({ assetId: 'test-asset' }))
      return 'unreachable'
    }).pipe(
      Effect.catchTag('AssetNotFoundError', (e) =>
        Effect.succeed(`Recovered from: ${e.assetId}`)
      )
    )

    const result = await Effect.runPromise(program)
    expect(result).toBe('Recovered from: test-asset')
  })

  it('should work with Effect.catchTags', async () => {
    const mayFail = (which: 'notFound' | 'conflict'): Effect.Effect<string, AssetCommandError> =>
      which === 'notFound'
        ? Effect.fail(new AssetNotFoundError({ assetId: 'nf' }))
        : Effect.fail(new AssetConflictError({ assetId: 'cf', expectedVersion: 1, actualVersion: 2 }))

    const program = (which: 'notFound' | 'conflict') =>
      mayFail(which).pipe(
        Effect.catchTags({
          AssetNotFoundError: (e) => Effect.succeed(`not found: ${e.assetId}`),
          AssetValidationError: (e) => Effect.succeed(`validation: ${e.field}`),
          AssetConflictError: (e) => Effect.succeed(`conflict: ${e.expectedVersion}/${e.actualVersion}`),
        })
      )

    expect(await Effect.runPromise(program('notFound'))).toBe('not found: nf')
    expect(await Effect.runPromise(program('conflict'))).toBe('conflict: 1/2')
  })
})
