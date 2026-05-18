/**
 * WorkOrderMachine - Effect Machine for Work Order Lifecycle
 *
 * Internal actor-style state machine that wraps WorkOrderState service.
 * Used by WorkOrderEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (FDA 21 CFR Part 11 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * WorkOrderEntity.toLayer()
 *   └─▶ Machine.boot(WorkOrderMachine)
 *         └─▶ actor.send(InternalCreateWorkOrder)
 *               └─▶ Machine.procedures.add() handler
 *                     └─▶ state.create/get/set (StateService)
 *                     └─▶ maybeEmitWorkOrder() (EventLog)
 * ```
 *
 * @module
 */

/**
 * ## Scope Management
 *
 * `Machine.boot()` is scope-aware by design. Its signature returns:
 * ```
 * Effect<Actor, never, R | Scope.Scope>
 * ```
 *
 * **Lifecycle guarantees provided by scope:**
 *
 * - **PubSub cleanup**: Internal mailbox created via
 *   `Effect.acquireRelease(PubSub.unbounded(), PubSub.shutdown)` —
 *   automatically shut down when the enclosing scope finalizes.
 *
 * - **Fiber lifecycle**: Background fibers launched via `Effect.forkScoped` —
 *   interrupted and joined when scope closes.
 *
 * - **Child coordination**: Child fibers managed via `FiberSet.join` +
 *   `FiberMap.join` — all joined before scope finalization completes.
 *
 * **Boot pattern:**
 * ```typescript
 * // Inside Entity.toLayer() — scope provided by Layer construction
 * const actor = yield* Machine.boot(machine)
 * // Actor lifetime = handler scope
 * ```
 *
 * **Anti-patterns:**
 * - Do NOT use `Effect.scoped` inside procedures (scope is external)
 * - Do NOT use `acquireRelease` inside procedures (boot handles this)
 * - Do NOT call `Machine.boot` without `Scope.Scope` in context
 */

import { Schema, Effect, DateTime, Option } from 'effect'
import { Machine } from '@effect/experimental'
import { SqlClient } from '@effect/sql'
import type { WorkOrderStateShape, CreateWorkOrderInput } from '../state/StateShape'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { WorkOrder, WorkOrderStatus, SuspensionReason } from '../schemas/work-orders'
import { PropagationId, type WorkOrderId } from '../schemas/identifiers'
import {
  canSubmitWorkOrder,
  canApproveWorkOrder,
  canRejectWorkOrder,
  canStartWorkOrder,
  canSuspendWorkOrder,
  canResumeWorkOrder,
  canCompleteWorkOrder,
  canFailWorkOrder,
  canCancelWorkOrder,
  canCloseWorkOrder,
  type WorkOrderStateNode,
} from './graphs/work-order-graph'
import type { WorkOrderTransitionRepository } from '../repos/WorkOrderTransitionRepo'
import type { DomainEventEmitterShape } from '../services/events'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Work order not found in state service */
export class MachineWorkOrderNotFoundError extends Schema.TaggedError<MachineWorkOrderNotFoundError>()(
  'MachineWorkOrderNotFoundError',
  {
    workOrderId: Schema.String,
  }
) {}

/** Invalid state transition per FDA 21 CFR Part 11 graph */
export class MachineWorkOrderInvalidTransitionError extends Schema.TaggedError<MachineWorkOrderInvalidTransitionError>()(
  'MachineWorkOrderInvalidTransitionError',
  {
    workOrderId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineWorkOrderCreateError extends Schema.TaggedError<MachineWorkOrderCreateError>()(
  'MachineWorkOrderCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

/**
 * Internal request to create a work order.
 * Not exposed as RPC — used for Machine procedure delegation.
 */
export class InternalCreateWorkOrder extends Schema.TaggedRequest<InternalCreateWorkOrder>()(
  'InternalCreateWorkOrder',
  {
    failure: MachineWorkOrderCreateError,
    success: WorkOrder,
    payload: {
      input: Schema.Unknown, // CreateWorkOrderInput
    },
  }
) {}

/**
 * Internal request to get a work order by ID.
 */
export class InternalGetWorkOrder extends Schema.TaggedRequest<InternalGetWorkOrder>()(
  'InternalGetWorkOrder',
  {
    failure: MachineWorkOrderNotFoundError,
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
    },
  }
) {}

/**
 * Internal request to submit a work order for approval.
 */
export class InternalSubmitWorkOrder extends Schema.TaggedRequest<InternalSubmitWorkOrder>()(
  'InternalSubmitWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      submittedBy: Schema.String,
    },
  }
) {}

/**
 * Internal request to approve a work order.
 */
export class InternalApproveWorkOrder extends Schema.TaggedRequest<InternalApproveWorkOrder>()(
  'InternalApproveWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      approvedBy: Schema.String,
      notes: Schema.optional(Schema.String),
    },
  }
) {}

/**
 * Internal request to reject a work order.
 */
export class InternalRejectWorkOrder extends Schema.TaggedRequest<InternalRejectWorkOrder>()(
  'InternalRejectWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      rejectedBy: Schema.String,
      reason: Schema.String,
    },
  }
) {}

/**
 * Internal request to start a work order.
 */
export class InternalStartWorkOrder extends Schema.TaggedRequest<InternalStartWorkOrder>()(
  'InternalStartWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      startedBy: Schema.String,
    },
  }
) {}

/**
 * Internal request to suspend a work order.
 */
export class InternalSuspendWorkOrder extends Schema.TaggedRequest<InternalSuspendWorkOrder>()(
  'InternalSuspendWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      suspendedBy: Schema.String,
      reason: SuspensionReason,
      expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
      causedByPropagationId: Schema.optionalWith(PropagationId, { as: 'Option' }),
    },
  }
) {}

/**
 * Internal request to resume a suspended work order.
 */
export class InternalResumeWorkOrder extends Schema.TaggedRequest<InternalResumeWorkOrder>()(
  'InternalResumeWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      resumedBy: Schema.String,
    },
  }
) {}

/**
 * Internal request to complete a work order.
 */
export class InternalCompleteWorkOrder extends Schema.TaggedRequest<InternalCompleteWorkOrder>()(
  'InternalCompleteWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      completedBy: Schema.String,
      notes: Schema.optional(Schema.String),
    },
  }
) {}

/**
 * Internal request to mark a work order as failed.
 */
export class InternalFailWorkOrder extends Schema.TaggedRequest<InternalFailWorkOrder>()(
  'InternalFailWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      failedBy: Schema.String,
      reason: Schema.String,
    },
  }
) {}

/**
 * Internal request to cancel a work order.
 */
export class InternalCancelWorkOrder extends Schema.TaggedRequest<InternalCancelWorkOrder>()(
  'InternalCancelWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      cancelledBy: Schema.String,
      reason: Schema.String,
    },
  }
) {}

/**
 * Internal request to close a work order.
 */
export class InternalCloseWorkOrder extends Schema.TaggedRequest<InternalCloseWorkOrder>()(
  'InternalCloseWorkOrder',
  {
    failure: Schema.Union(MachineWorkOrderNotFoundError, MachineWorkOrderInvalidTransitionError),
    success: WorkOrder,
    payload: {
      workOrderId: Schema.String,
      closedBy: Schema.String,
      notes: Schema.optional(Schema.String),
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

/**
 * Internal machine state tracking current work order mode.
 */
export interface WorkOrderMachineState {
  /** Current operational mode (tracks last known work order state) */
  readonly mode: WorkOrderStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

/**
 * Dependencies required to construct the WorkOrderMachine.
 * Injected via Entity.toLayer() Effect.gen.
 */
export interface WorkOrderMachineDeps {
  /** State service port for work order persistence */
  readonly state: WorkOrderStateShape
  /** Feature flags for event emission control */
  readonly flags: FeatureFlagsShape
  /** Transition repo for audit trail (dual-write pattern) */
  readonly transitionRepo: WorkOrderTransitionRepository
  /** SQL client for transactional operations */
  readonly sql: SqlClient.SqlClient
  /** Optional durable/realtime domain event emitter */
  readonly eventEmitter?: DomainEventEmitterShape
}

// =============================================================================
// Event Emission Helper
// =============================================================================

/**
 * Conditionally emit work order events based on feature flags.
 */
const maybeEmitWorkOrder = (
  flags: FeatureFlagsShape,
  eventEmitter: DomainEventEmitterShape | undefined,
  eventType: string,
  payload: Record<string, unknown>
) =>
  Effect.gen(function* () {
    if (!flags.workOrderEventSourcingEnabled) return

    const workOrder = payload['workOrder']
    if (!(workOrder instanceof WorkOrder)) {
      yield* Effect.logWarning(`[WorkOrderMachine] Skipping ${eventType}: missing WorkOrder payload`)
      return
    }

    if (!eventEmitter) {
      yield* Effect.logWarning(`[WorkOrderMachine] Skipping ${eventType}: DomainEventEmitter not provided`)
      return
    }

    const actor =
      typeof payload['actor'] === 'string' ? payload['actor']
        : typeof payload['approvedBy'] === 'string' ? payload['approvedBy']
        : typeof payload['rejectedBy'] === 'string' ? payload['rejectedBy']
        : typeof payload['startedBy'] === 'string' ? payload['startedBy']
        : typeof payload['suspendedBy'] === 'string' ? payload['suspendedBy']
        : typeof payload['resumedBy'] === 'string' ? payload['resumedBy']
        : typeof payload['completedBy'] === 'string' ? payload['completedBy']
        : typeof payload['failedBy'] === 'string' ? payload['failedBy']
        : typeof payload['cancelledBy'] === 'string' ? payload['cancelledBy']
        : typeof payload['closedBy'] === 'string' ? payload['closedBy']
        : undefined

    yield* eventEmitter.emitWorkOrderLifecycleStrict({
      tag: eventType as never,
      workOrder,
      actor,
      reason: typeof payload['reason'] === 'string' ? payload['reason'] : undefined,
      notes: typeof payload['notes'] === 'string' ? payload['notes'] : undefined,
    })
  })

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a WorkOrderMachine with injected dependencies.
 *
 * The machine wraps the WorkOrderState service and validates
 * all state transitions via the FDA 21 CFR Part 11 state graph.
 */
export const makeWorkOrderMachine = (deps: WorkOrderMachineDeps) =>
  Machine.make(
    (_input: void, previous?: WorkOrderMachineState) =>
      Effect.gen(function* () {
        const { state, flags, transitionRepo, sql, eventEmitter } = deps

        // Initial machine state
        const initialState: WorkOrderMachineState = previous ?? { mode: 'created' }

        return Machine.procedures.make(initialState).pipe(
          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateWorkOrder>()(
            'InternalCreateWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.create(request.input as CreateWorkOrderInput).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderCreateError({ message: `Create work order failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Created work order ${workOrder.id}`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderCreated', { workOrder })

                return [workOrder, { mode: 'created' as WorkOrderStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetWorkOrder>()(
            'InternalGetWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                return [workOrder, { mode: workOrder.status as WorkOrderStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SUBMIT (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSubmitWorkOrder>()(
            'InternalSubmitWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'submitted'

                if (!canSubmitWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot submit work order in state '${currentState}'. Work order must be in 'created' state.`,
                    })
                  )
                }

                const submitted = new WorkOrder({
                  ...workOrder,
                  status: 'submitted' as WorkOrderStatus,
                })

                yield* state.set(submitted)
                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} submitted`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderSubmitted', { workOrder: submitted, actor: request.submittedBy })

                return [submitted, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // APPROVE (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalApproveWorkOrder>()(
            'InternalApproveWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'approved'

                if (!canApproveWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot approve work order in state '${currentState}'. Work order must be in 'submitted' state.`,
                    })
                  )
                }

                const approved = new WorkOrder({
                  ...workOrder,
                  status: 'approved' as WorkOrderStatus,
                  assignedTo: Option.some(request.approvedBy),
                })

                yield* state.set(approved)
                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} approved by ${request.approvedBy}`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderApproved', { workOrder: approved, approvedBy: request.approvedBy })

                return [approved, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // REJECT (graph-validated, transactional dual-write)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalRejectWorkOrder>()(
            'InternalRejectWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'rejected'

                if (!canRejectWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot reject work order in state '${currentState}'. Work order must be in 'submitted' state.`,
                    })
                  )
                }

                // Transactional dual-write: update state + insert transition
                const rejected = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder status only (no audit fields on entity)
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'rejected' as WorkOrderStatus,
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    // Note: transitionedAt uses database DEFAULT NOW() for tamper-proof timestamp
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'rejected' as WorkOrderStatus,
                      transitionedBy: Option.some(request.rejectedBy),
                      reason: Option.some(request.reason),
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} rejected by ${request.rejectedBy}`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderRejected', { workOrder: rejected, rejectedBy: request.rejectedBy, reason: request.reason })

                return [rejected, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // START (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStartWorkOrder>()(
            'InternalStartWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'started'

                if (!canStartWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot start work order in state '${currentState}'. Work order must be in 'approved' state.`,
                    })
                  )
                }

                const now = yield* DateTime.now
                const started = new WorkOrder({
                  ...workOrder,
                  status: 'started' as WorkOrderStatus,
                  actualStart: Option.some(now),
                })

                yield* state.set(started)
                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} started`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderStarted', { workOrder: started, actor: request.startedBy })

                return [started, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SUSPEND (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSuspendWorkOrder>()(
            'InternalSuspendWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'suspended'

                const alreadyHandledPropagation = Option.isSome(request.causedByPropagationId)
                  ? yield* transitionRepo.hasInboundPropagation(
                    workOrder.id,
                    request.causedByPropagationId.value,
                  )
                  : false

                if (alreadyHandledPropagation) {
                  yield* Effect.logInfo(
                    `[WorkOrderMachine] Work order ${request.workOrderId} suspend already handled for propagation ${request.causedByPropagationId.value}`,
                  )
                  return [workOrder, { mode: currentState }] as const
                }

                if (!canSuspendWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot suspend work order in state '${currentState}'. Work order must be in 'started' or 'resumed' state.`,
                    })
                  )
                }

                // Transactional dual-write: update state + insert transition
                const suspended = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder with fields that exist on schema
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'suspended' as WorkOrderStatus,
                      suspensionReason: Option.some(request.reason),
                      expectedResume: request.expectedResume,
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    // Note: transitionedAt uses database DEFAULT NOW() for tamper-proof timestamp
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'suspended' as WorkOrderStatus,
                      transitionedBy: Option.some(request.suspendedBy),
                      reason: Option.some(request.reason as string),
                      propagationId: Option.none(),
                      causedByPropagationId: request.causedByPropagationId,
                    })

                    yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderSuspended', {
                      workOrder: updated,
                      actor: request.suspendedBy,
                      reason: request.reason,
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} suspended`)

                return [suspended, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RESUME (graph-validated, transactional dual-write)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalResumeWorkOrder>()(
            'InternalResumeWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'resumed'

                if (!canResumeWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot resume work order in state '${currentState}'. Work order must be in 'suspended' state.`,
                    })
                  )
                }

                // Transactional dual-write: update state + insert transition
                const resumed = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder - clear suspension info (fields that exist on schema)
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'resumed' as WorkOrderStatus,
                      suspensionReason: Option.none(),
                      expectedResume: Option.none(),
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'resumed' as WorkOrderStatus,
                      transitionedBy: Option.some(request.resumedBy),
                      reason: Option.none(),
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} resumed`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderResumed', { workOrder: resumed, actor: request.resumedBy })

                return [resumed, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE (graph-validated, transactional dual-write)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteWorkOrder>()(
            'InternalCompleteWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'completed'

                if (!canCompleteWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot complete work order in state '${currentState}'. Work order must be in 'started' or 'resumed' state.`,
                    })
                  )
                }

                const now = yield* DateTime.now

                // Transactional dual-write: update state + insert transition
                const completed = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder (completedBy stored in transition, not entity)
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'completed' as WorkOrderStatus,
                      actualEnd: Option.some(now),
                      outcome: Option.some('success' as const),
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'completed' as WorkOrderStatus,
                      transitionedBy: Option.some(request.completedBy),
                      reason: request.notes ? Option.some(request.notes) : Option.none(),
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} completed`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderCompleted', { workOrder: completed, actor: request.completedBy, notes: request.notes })

                return [completed, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // FAIL (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalFailWorkOrder>()(
            'InternalFailWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'failed'

                if (!canFailWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot fail work order in state '${currentState}'. Work order must be in 'started' or 'resumed' state.`,
                    })
                  )
                }

                const now = yield* DateTime.now
                const failed = new WorkOrder({
                  ...workOrder,
                  status: 'failed' as WorkOrderStatus,
                  actualEnd: Option.some(now),
                  failureReason: Option.some(request.reason),
                })

                yield* state.set(failed)
                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} failed`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderFailed', { workOrder: failed, actor: request.failedBy, reason: request.reason })

                return [failed, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CANCEL (graph-validated, transactional dual-write)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCancelWorkOrder>()(
            'InternalCancelWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'cancelled'

                if (!canCancelWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot cancel work order in state '${currentState}'. Work order must be in 'created', 'approved', or 'suspended' state.`,
                    })
                  )
                }

                // Transactional dual-write: update state + insert transition
                const cancelled = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder (cancelledAt/cancelledBy stored in transition, not entity)
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'cancelled' as WorkOrderStatus,
                      cancellationReason: Option.some(request.reason),
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'cancelled' as WorkOrderStatus,
                      transitionedBy: Option.some(request.cancelledBy),
                      reason: Option.some(request.reason),
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} cancelled`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderCancelled', { workOrder: cancelled, actor: request.cancelledBy, reason: request.reason })

                return [cancelled, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLOSE (graph-validated, transactional dual-write)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCloseWorkOrder>()(
            'InternalCloseWorkOrder',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workOrder = yield* state.get(request.workOrderId as WorkOrderId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkOrderNotFoundError({ workOrderId: request.workOrderId }))
                  )
                )

                const currentState = workOrder.status as WorkOrderStateNode
                const targetState: WorkOrderStateNode = 'closed'

                if (!canCloseWorkOrder(currentState)) {
                  return yield* Effect.fail(
                    new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot close work order in state '${currentState}'. Work order must be in 'completed', 'failed', or 'cancelled' state.`,
                    })
                  )
                }

                // Determine final status based on current state
                const finalStatus = currentState === 'completed'
                  ? 'completed_success' as const
                  : currentState === 'failed'
                    ? 'failed' as const
                    : 'cancelled_before_start' as const

                // Transactional dual-write: update state + insert transition
                const closed = yield* sql.withTransaction(
                  Effect.gen(function* () {
                    // 1. Update WorkOrder (closedAt/closedBy stored in transition, not entity)
                    const updated = new WorkOrder({
                      ...workOrder,
                      status: 'closed' as WorkOrderStatus,
                      finalStatus: Option.some(finalStatus),
                    })
                    yield* state.set(updated)

                    // 2. Insert transition record for FDA audit trail
                    yield* transitionRepo.insert({
                      workOrderId: workOrder.id,
                      fromState: currentState as WorkOrderStatus,
                      toState: 'closed' as WorkOrderStatus,
                      transitionedBy: Option.some(request.closedBy),
                      reason: request.notes ? Option.some(request.notes) : Option.none(),
                    })

                    return updated
                  })
                ).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkOrderInvalidTransitionError({
                      workOrderId: request.workOrderId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Failed to record transition: ${String(e)}`,
                    }))
                  )
                )

                yield* Effect.logInfo(`[WorkOrderMachine] Work order ${request.workOrderId} closed`)
                yield* maybeEmitWorkOrder(flags, eventEmitter, 'WorkOrderClosed', { workOrder: closed, actor: request.closedBy, notes: request.notes })

                return [closed, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the WorkOrderMachine */
export type WorkOrderMachine = ReturnType<typeof makeWorkOrderMachine>

/** Type of the booted WorkOrderMachine actor */
export type WorkOrderMachineActor = Awaited<ReturnType<typeof Machine.boot<WorkOrderMachine>>>
