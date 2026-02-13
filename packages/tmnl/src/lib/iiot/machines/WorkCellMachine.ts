/**
 * WorkCellMachine - Effect Machine for WorkCell Lifecycle
 *
 * Internal actor-style state machine that wraps WorkCellState service.
 * Used by WorkCellEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * WorkCellEntity.toLayer()
 *   |-> Machine.boot(WorkCellMachine)
 *         |-> actor.send(InternalCreateWorkCell)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> event emission (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { WorkCellStateShape } from '../state/WorkCellState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { WorkCell, CreateWorkCellParams } from '../schemas/assets/workcell'
import type { WorkCellId } from '../schemas/identifiers'
import {
  canBeginSetup,
  canCompleteSetup,
  canStop,
  canMarkBlocked,
  canClearBlocked,
  canMarkFaulted,
  canClearFault,
  canEnterMaintenance,
  canCompleteMaintenance,
  canDecommission,
  type WorkcellStateNode,
} from './graphs/workcell-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** WorkCell not found in state service */
export class MachineWorkCellNotFoundError extends Schema.TaggedError<MachineWorkCellNotFoundError>()(
  'MachineWorkCellNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-95 workcell graph */
export class MachineWorkCellInvalidTransitionError extends Schema.TaggedError<MachineWorkCellInvalidTransitionError>()(
  'MachineWorkCellInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineWorkCellCreateError extends Schema.TaggedError<MachineWorkCellCreateError>()(
  'MachineWorkCellCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateWorkCell extends Schema.TaggedRequest<InternalCreateWorkCell>()(
  'InternalCreateWorkCell',
  {
    failure: MachineWorkCellCreateError,
    success: WorkCell,
    payload: {
      params: CreateWorkCellParams,
    },
  }
) {}

export class InternalGetWorkCell extends Schema.TaggedRequest<InternalGetWorkCell>()(
  'InternalGetWorkCell',
  {
    failure: MachineWorkCellNotFoundError,
    success: WorkCell,
    payload: {
      workCellId: Schema.String,
    },
  }
) {}

export class InternalUpdateWorkCell extends Schema.TaggedRequest<InternalUpdateWorkCell>()(
  'InternalUpdateWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellCreateError),
    success: WorkCell,
    payload: {
      workCell: WorkCell,
    },
  }
) {}

// =============================================================================
// Transition Requests
// =============================================================================

export class InternalBeginSetup extends Schema.TaggedRequest<InternalBeginSetup>()(
  'InternalBeginSetup',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalCompleteSetup extends Schema.TaggedRequest<InternalCompleteSetup>()(
  'InternalCompleteSetup',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalStopWorkCell extends Schema.TaggedRequest<InternalStopWorkCell>()(
  'InternalStopWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalMarkBlockedWorkCell extends Schema.TaggedRequest<InternalMarkBlockedWorkCell>()(
  'InternalMarkBlockedWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalClearBlockedWorkCell extends Schema.TaggedRequest<InternalClearBlockedWorkCell>()(
  'InternalClearBlockedWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalMarkFaulted extends Schema.TaggedRequest<InternalMarkFaulted>()(
  'InternalMarkFaulted',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalClearFault extends Schema.TaggedRequest<InternalClearFault>()(
  'InternalClearFault',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalEnterMaintenanceWorkCell extends Schema.TaggedRequest<InternalEnterMaintenanceWorkCell>()(
  'InternalEnterMaintenanceWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalCompleteMaintenanceWorkCell extends Schema.TaggedRequest<InternalCompleteMaintenanceWorkCell>()(
  'InternalCompleteMaintenanceWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

export class InternalDecommissionWorkCell extends Schema.TaggedRequest<InternalDecommissionWorkCell>()(
  'InternalDecommissionWorkCell',
  {
    failure: Schema.Union(MachineWorkCellNotFoundError, MachineWorkCellInvalidTransitionError),
    success: WorkCell,
    payload: { workCellId: Schema.String },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface WorkCellMachineState {
  readonly mode: WorkcellStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface WorkCellMachineDeps {
  readonly state: WorkCellStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Transition Procedure Helper
// =============================================================================

/**
 * Creates a standard transition procedure body for the WorkCellMachine.
 * Reduces boilerplate across all graph-validated transitions.
 */
const makeTransitionProcedure = (
  state: WorkCellStateShape,
  request: { workCellId: string },
  targetState: WorkcellStateNode,
  canTransition: (s: WorkcellStateNode) => boolean,
  actionName: string
) =>
  Effect.gen(function* () {
    const workCell = yield* state.get(request.workCellId as WorkCellId).pipe(
      Effect.catchAll(() =>
        Effect.fail(new MachineWorkCellNotFoundError({ entityId: request.workCellId }))
      )
    )

    const currentState = workCell.status as WorkcellStateNode

    if (!canTransition(currentState)) {
      return yield* Effect.fail(
        new MachineWorkCellInvalidTransitionError({
          entityId: request.workCellId,
          fromState: currentState,
          toState: targetState,
          message: `Cannot ${actionName} in state '${currentState}'.`,
        })
      )
    }

    const updated = new WorkCell({ ...workCell, status: targetState })
    yield* state.set(updated)
    yield* Effect.logInfo(`[WorkCellMachine] WorkCell ${request.workCellId} ${actionName}`)

    return [updated, { mode: targetState }] as const
  })

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a WorkCellMachine with injected dependencies.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makeWorkCellMachine = (deps: WorkCellMachineDeps) =>
  Machine.make(
    (_input: void, previous?: WorkCellMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        const initialState: WorkCellMachineState = previous ?? { mode: 'idle' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateWorkCell>()(
            'InternalCreateWorkCell',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workCell = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkCellCreateError({ message: `Create work cell failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[WorkCellMachine] Created work cell ${workCell.id}`)
                yield* Effect.logInfo(`[ES:WorkCell] WorkCellCreated`, { payload: { workCell } }).pipe(
                  Effect.catchAll((err) => Effect.logWarning(`Event emission failed: ${String(err)}`))
                )

                return [workCell, { mode: 'idle' as WorkcellStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetWorkCell>()(
            'InternalGetWorkCell',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const workCell = yield* state.get(request.workCellId as WorkCellId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkCellNotFoundError({ entityId: request.workCellId }))
                  )
                )

                return [workCell, { mode: workCell.status as WorkcellStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateWorkCell>()(
            'InternalUpdateWorkCell',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.workCell.id as WorkCellId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWorkCellNotFoundError({ entityId: request.workCell.id }))
                  )
                )

                yield* state.set(request.workCell).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWorkCellCreateError({ message: `Update work cell failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[WorkCellMachine] Updated work cell ${request.workCell.id}`)

                return [request.workCell, { mode: request.workCell.status as WorkcellStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // BEGIN SETUP (graph-validated): idle -> setup
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalBeginSetup>()(
            'InternalBeginSetup',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'setup', canBeginSetup, 'begin setup')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE SETUP (graph-validated): setup -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteSetup>()(
            'InternalCompleteSetup',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canCompleteSetup, 'complete setup')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // STOP (graph-validated): running -> idle
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStopWorkCell>()(
            'InternalStopWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'idle', canStop, 'stop')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK BLOCKED (graph-validated): running -> blocked
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMarkBlockedWorkCell>()(
            'InternalMarkBlockedWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'blocked', canMarkBlocked, 'mark blocked')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR BLOCKED (graph-validated): blocked -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearBlockedWorkCell>()(
            'InternalClearBlockedWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canClearBlocked, 'clear blocked')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK FAULTED (graph-validated): running -> faulted
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMarkFaulted>()(
            'InternalMarkFaulted',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'faulted', canMarkFaulted, 'mark faulted')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR FAULT (graph-validated): faulted -> idle
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearFault>()(
            'InternalClearFault',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'idle', canClearFault, 'clear fault')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ENTER MAINTENANCE (graph-validated): idle|faulted -> maintenance
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalEnterMaintenanceWorkCell>()(
            'InternalEnterMaintenanceWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'maintenance', canEnterMaintenance, 'enter maintenance')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE MAINTENANCE (graph-validated): maintenance -> idle
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteMaintenanceWorkCell>()(
            'InternalCompleteMaintenanceWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'idle', canCompleteMaintenance, 'complete maintenance')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (graph-validated): idle|maintenance -> decommissioned
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommissionWorkCell>()(
            'InternalDecommissionWorkCell',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'decommissioned', canDecommission, 'decommission')
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the WorkCellMachine */
export type WorkCellMachine = ReturnType<typeof makeWorkCellMachine>

/** Type of the booted WorkCellMachine actor */
export type WorkCellMachineActor = Awaited<ReturnType<typeof Machine.boot<WorkCellMachine>>>
