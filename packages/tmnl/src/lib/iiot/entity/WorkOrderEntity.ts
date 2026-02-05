/**
 * WorkOrderEntity - Effect Cluster Entity for Work Order Lifecycle
 *
 * Manages FDA 21 CFR Part 11 compliant work order lifecycle per ISA-95.
 * Work orders are EVENT SOURCED for full audit trail.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: FDA 21 CFR Part 11 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 * - Audit Trail: Dual-write to work_order_transitions table in Machine procedures
 *
 * State Machine:
 * created → submitted → approved → started → completed → closed
 *     ↓          ↓          ↓          ↓
 * cancelled  rejected   cancelled   suspended → resumed → completed
 *                                        ↓            ↓
 *                                    cancelled      failed → closed
 *
 * @module
 */

import { Schema, Effect, Option, DateTime } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { SqlClient } from '@effect/sql'
import {
  WorkOrderId,
  WorkflowDefinitionId,
  TaskInstanceId,
  AssetId,
} from '../schemas/identifiers'
import {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderOutcome,
  SuspensionReason,
  WorkOrderFinalStatus,
} from '../schemas/work-orders'
import { WorkOrderState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import { WorkOrderTransitionRepo } from '../repos'
import {
  makeWorkOrderMachine,
  InternalCreateWorkOrder,
  InternalGetWorkOrder,
  InternalSubmitWorkOrder,
  InternalApproveWorkOrder,
  InternalRejectWorkOrder,
  InternalStartWorkOrder,
  InternalSuspendWorkOrder,
  InternalResumeWorkOrder,
  InternalCompleteWorkOrder,
  InternalFailWorkOrder,
  InternalCancelWorkOrder,
  InternalCloseWorkOrder,
} from '../machines/WorkOrderMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Work order not found error */
export class RpcWorkOrderNotFoundError extends Schema.TaggedError<RpcWorkOrderNotFoundError>()(
  'RpcWorkOrderNotFoundError',
  {
    workOrderId: WorkOrderId,
  }
) {}

/** Invalid state transition error */
export class RpcWorkOrderTransitionError extends Schema.TaggedError<RpcWorkOrderTransitionError>()(
  'RpcWorkOrderTransitionError',
  {
    workOrderId: WorkOrderId,
    currentState: WorkOrderStatus,
    targetState: WorkOrderStatus,
    message: Schema.String,
  }
) {}

/** Work order validation error */
export class RpcWorkOrderValidationError extends Schema.TaggedError<RpcWorkOrderValidationError>()(
  'RpcWorkOrderValidationError',
  {
    workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const WorkOrderEntityType = 'WorkOrder' as const
export const WorkOrderCreateTag = `${WorkOrderEntityType}.Create` as const
export const WorkOrderGetTag = `${WorkOrderEntityType}.Get` as const
export const WorkOrderSubmitTag = `${WorkOrderEntityType}.Submit` as const
export const WorkOrderApproveTag = `${WorkOrderEntityType}.Approve` as const
export const WorkOrderRejectTag = `${WorkOrderEntityType}.Reject` as const
export const WorkOrderStartTag = `${WorkOrderEntityType}.Start` as const
export const WorkOrderSuspendTag = `${WorkOrderEntityType}.Suspend` as const
export const WorkOrderResumeTag = `${WorkOrderEntityType}.Resume` as const
export const WorkOrderCompleteTag = `${WorkOrderEntityType}.Complete` as const
export const WorkOrderFailTag = `${WorkOrderEntityType}.Fail` as const
export const WorkOrderCancelTag = `${WorkOrderEntityType}.Cancel` as const
export const WorkOrderCloseTag = `${WorkOrderEntityType}.Close` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Create a new work order
 */
export class CreateWorkOrderRpc extends Rpc.make(WorkOrderCreateTag, {
  payload: Schema.Struct({
    workflowDefinitionId: WorkflowDefinitionId,
    workflowVersion: Schema.String,
    title: Schema.NonEmptyString,
    description: Schema.String,
    type: WorkOrderType,
    priority: WorkOrderPriority,
    createdBy: Schema.String,
    scheduledStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    dueDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    parentWorkOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
    primaryAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),
  }),
  success: WorkOrder,
  error: RpcWorkOrderValidationError,
}) {}

/**
 * Get work order by ID
 */
export class GetWorkOrderRpc extends Rpc.make(WorkOrderGetTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
  }),
  success: WorkOrder,
  error: RpcWorkOrderNotFoundError,
}) {}

/**
 * Submit work order for approval
 */
export class SubmitWorkOrderRpc extends Rpc.make(WorkOrderSubmitTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Approve work order
 */
export class ApproveWorkOrderRpc extends Rpc.make(WorkOrderApproveTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    approvalLevel: Schema.Number,
    comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Reject work order
 */
export class RejectWorkOrderRpc extends Rpc.make(WorkOrderRejectTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    reason: Schema.NonEmptyString,
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Start work order execution
 */
export class StartWorkOrderRpc extends Rpc.make(WorkOrderStartTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Suspend work order
 */
export class SuspendWorkOrderRpc extends Rpc.make(WorkOrderSuspendTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    reason: SuspensionReason,
    expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Resume suspended work order
 */
export class ResumeWorkOrderRpc extends Rpc.make(WorkOrderResumeTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Complete work order
 */
export class CompleteWorkOrderRpc extends Rpc.make(WorkOrderCompleteTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    outcome: WorkOrderOutcome,
    summary: Schema.String,
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Fail work order
 */
export class FailWorkOrderRpc extends Rpc.make(WorkOrderFailTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    failedTaskId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),
    failureReason: Schema.NonEmptyString,
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Cancel work order
 */
export class CancelWorkOrderRpc extends Rpc.make(WorkOrderCancelTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    reason: Schema.NonEmptyString,
    compensationRequired: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

/**
 * Close work order (archive)
 */
export class CloseWorkOrderRpc extends Rpc.make(WorkOrderCloseTag, {
  payload: Schema.Struct({
    workOrderId: WorkOrderId,
    finalStatus: WorkOrderFinalStatus,
    notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  success: WorkOrder,
  error: Schema.Union(RpcWorkOrderNotFoundError, RpcWorkOrderTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * WorkOrder Entity
 *
 * Distributed actor managing work order lifecycle state.
 * Each work order instance is keyed by workOrderId.
 *
 * Work orders are EVENT SOURCED for FDA 21 CFR Part 11 compliance.
 * All state transitions are recorded in the EventLog.
 */
export const WorkOrderEntity = Entity.make(WorkOrderEntityType, [
  CreateWorkOrderRpc,
  GetWorkOrderRpc,
  SubmitWorkOrderRpc,
  ApproveWorkOrderRpc,
  RejectWorkOrderRpc,
  StartWorkOrderRpc,
  SuspendWorkOrderRpc,
  ResumeWorkOrderRpc,
  CompleteWorkOrderRpc,
  FailWorkOrderRpc,
  CancelWorkOrderRpc,
  CloseWorkOrderRpc,
])

/**
 * Type helper for WorkOrder Entity
 */
export type WorkOrderEntity = typeof WorkOrderEntity

// =============================================================================
// Handler Implementation (REFACTORED - delegates to Machine)
// =============================================================================

/**
 * WorkOrderEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots WorkOrderMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via FDA 21 CFR Part 11 graph
 * - StateService wrapped by Machine procedures
 * - Audit trail dual-written to work_order_transitions table
 *
 * Usage:
 * ```typescript
 * // Testing: In-memory adapters
 * const TestStack = WorkOrderEntityHandlers.pipe(
 *   Layer.provide(AllStateServicesInMemory),
 *   Layer.provide(IIoTFeatureFlagsDisabledLayer)
 * )
 *
 * // Production: SQL-backed adapters
 * const ProdStack = WorkOrderEntityHandlers.pipe(
 *   Layer.provide(WorkOrderStateSqlLive),
 *   Layer.provide(IIoTFeatureFlagsEnvLayer)
 * )
 * ```
 */
export const WorkOrderEntityHandlers = WorkOrderEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* WorkOrderState           // Port: state persistence
    const flags = yield* IIoTFeatureFlags         // Port: feature flags
    const transitionRepo = yield* WorkOrderTransitionRepo  // Port: audit trail
    const sql = yield* SqlClient.SqlClient        // Port: transactions

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const workOrderMachine = makeWorkOrderMachine({ state, flags, transitionRepo, sql })
    const actor = yield* Machine.boot(workOrderMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create handler - delegates to InternalCreateWorkOrder procedure
     */
    const handleCreate = (envelope: {
      payload: {
        workflowDefinitionId: string
        workflowVersion: string
        title: string
        description: string
        type: string
        priority: string
        createdBy: string
        scheduledStart?: Option.Option<unknown>
        dueDate?: Option.Option<unknown>
        parentWorkOrderId?: Option.Option<WorkOrderId>
        primaryAssetId?: Option.Option<AssetId>
        metadata?: Record<string, unknown>
      }
    }) =>
      actor.send(new InternalCreateWorkOrder({
        input: {
          workflowDefinitionId: envelope.payload.workflowDefinitionId,
          workflowVersion: envelope.payload.workflowVersion,
          title: envelope.payload.title,
          description: envelope.payload.description,
          type: envelope.payload.type,
          priority: envelope.payload.priority,
          createdBy: envelope.payload.createdBy,
          scheduledStart: envelope.payload.scheduledStart ?? Option.none(),
          dueDate: envelope.payload.dueDate ?? Option.none(),
          parentWorkOrderId: envelope.payload.parentWorkOrderId ?? Option.none(),
          primaryAssetId: envelope.payload.primaryAssetId ?? Option.none(),
          assignedTo: Option.none(),
          metadata: envelope.payload.metadata,
        },
      })).pipe(
        Effect.catchTag('MachineWorkOrderCreateError', (e) =>
          Effect.fail(new RpcWorkOrderValidationError({ workOrderId: Option.none(), message: e.message }))
        )
      )

    /**
     * Get handler - delegates to InternalGetWorkOrder procedure
     */
    const handleGet = (envelope: { payload: { workOrderId: WorkOrderId } }) =>
      actor.send(new InternalGetWorkOrder({ workOrderId: envelope.payload.workOrderId })).pipe(
        Effect.catchTag('MachineWorkOrderNotFoundError', (e) =>
          Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId }))
        )
      )

    /**
     * Submit handler - delegates to InternalSubmitWorkOrder procedure
     */
    const handleSubmit = (envelope: {
      payload: { workOrderId: WorkOrderId; comments?: Option.Option<string> }
    }) =>
      actor.send(new InternalSubmitWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        submittedBy: 'system', // TODO: Extract from context
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Approve handler - delegates to InternalApproveWorkOrder procedure
     */
    const handleApprove = (envelope: {
      payload: { workOrderId: WorkOrderId; approvalLevel: number; comments?: Option.Option<string> }
    }) =>
      actor.send(new InternalApproveWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        approvedBy: 'system', // TODO: Extract from context
        notes: Option.isSome(envelope.payload.comments ?? Option.none())
          ? Option.getOrElse(envelope.payload.comments ?? Option.none(), () => '')
          : undefined,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Reject handler - delegates to InternalRejectWorkOrder procedure
     */
    const handleReject = (envelope: {
      payload: { workOrderId: WorkOrderId; reason: string }
    }) =>
      actor.send(new InternalRejectWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        rejectedBy: 'system', // TODO: Extract from context
        reason: envelope.payload.reason,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Start handler - delegates to InternalStartWorkOrder procedure
     */
    const handleStart = (envelope: {
      payload: { workOrderId: WorkOrderId; assignedTo?: Option.Option<string> }
    }) =>
      actor.send(new InternalStartWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        startedBy: Option.isSome(envelope.payload.assignedTo ?? Option.none())
          ? Option.getOrElse(envelope.payload.assignedTo ?? Option.none(), () => 'system')
          : 'system',
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Suspend handler - delegates to InternalSuspendWorkOrder procedure
     */
    const handleSuspend = (envelope: {
      payload: {
        workOrderId: WorkOrderId
        reason: Schema.Schema.Type<typeof SuspensionReason>
        expectedResume?: Option.Option<DateTime.Utc>
        notes?: Option.Option<string>
      }
    }) =>
      actor.send(new InternalSuspendWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        suspendedBy: 'system', // TODO: Extract from context
        reason: envelope.payload.reason,
        expectedResume: envelope.payload.expectedResume ?? Option.none<DateTime.Utc>(),
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Resume handler - delegates to InternalResumeWorkOrder procedure
     */
    const handleResume = (envelope: {
      payload: { workOrderId: WorkOrderId; notes?: Option.Option<string> }
    }) =>
      actor.send(new InternalResumeWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        resumedBy: 'system', // TODO: Extract from context
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Complete handler - delegates to InternalCompleteWorkOrder procedure
     */
    const handleComplete = (envelope: {
      payload: { workOrderId: WorkOrderId; outcome: Schema.Schema.Type<typeof WorkOrderOutcome>; summary: string }
    }) =>
      actor.send(new InternalCompleteWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        completedBy: 'system', // TODO: Extract from context
        notes: envelope.payload.summary,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Fail handler - delegates to InternalFailWorkOrder procedure
     */
    const handleFail = (envelope: {
      payload: { workOrderId: WorkOrderId; failedTaskId?: Option.Option<TaskInstanceId>; failureReason: string }
    }) =>
      actor.send(new InternalFailWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        failedBy: 'system', // TODO: Extract from context
        reason: envelope.payload.failureReason,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Cancel handler - delegates to InternalCancelWorkOrder procedure
     */
    const handleCancel = (envelope: {
      payload: { workOrderId: WorkOrderId; reason: string; compensationRequired?: boolean }
    }) =>
      actor.send(new InternalCancelWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        cancelledBy: 'system', // TODO: Extract from context
        reason: envelope.payload.reason,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    /**
     * Close handler - delegates to InternalCloseWorkOrder procedure
     */
    const handleClose = (envelope: {
      payload: { workOrderId: WorkOrderId; finalStatus: Schema.Schema.Type<typeof WorkOrderFinalStatus>; notes?: Option.Option<string> }
    }) =>
      actor.send(new InternalCloseWorkOrder({
        workOrderId: envelope.payload.workOrderId,
        closedBy: 'system', // TODO: Extract from context
        notes: Option.isSome(envelope.payload.notes ?? Option.none())
          ? Option.getOrElse(envelope.payload.notes ?? Option.none(), () => '')
          : undefined,
      })).pipe(
        Effect.catchTags({
          MachineWorkOrderNotFoundError: (e) =>
            Effect.fail(new RpcWorkOrderNotFoundError({ workOrderId: e.workOrderId as WorkOrderId })),
          MachineWorkOrderInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkOrderTransitionError({
              workOrderId: e.workOrderId as WorkOrderId,
              currentState: e.fromState as WorkOrderStatus,
              targetState: e.toState as WorkOrderStatus,
              message: e.message,
            })),
        })
      )

    return WorkOrderEntity.of({
      [WorkOrderCreateTag]: handleCreate,
      [WorkOrderGetTag]: handleGet,
      [WorkOrderSubmitTag]: handleSubmit,
      [WorkOrderApproveTag]: handleApprove,
      [WorkOrderRejectTag]: handleReject,
      [WorkOrderStartTag]: handleStart,
      [WorkOrderSuspendTag]: handleSuspend,
      [WorkOrderResumeTag]: handleResume,
      [WorkOrderCompleteTag]: handleComplete,
      [WorkOrderFailTag]: handleFail,
      [WorkOrderCancelTag]: handleCancel,
      [WorkOrderCloseTag]: handleClose,
    })
  })
)
