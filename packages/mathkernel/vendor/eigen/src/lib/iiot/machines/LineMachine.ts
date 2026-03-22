/**
 * LineMachine - Effect Machine for Production Line Lifecycle
 *
 * Internal actor-style state machine that wraps LineState service.
 * Used by LineEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * LineEntity.toLayer()
 *   |-> Machine.boot(LineMachine)
 *         |-> actor.send(InternalCreateLine)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> event emission (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { LineStateShape } from '../state/LineState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Line, CreateLineParams } from '../schemas/assets/line'
import type { LineId } from '../schemas/identifiers'
import {
  canStart,
  canStop,
  canBeginChangeover,
  canCompleteChangeover,
  canMarkStarved,
  canClearStarved,
  canMarkBlocked,
  canClearBlocked,
  canEnterMaintenance,
  canCompleteMaintenance,
  canDecommission,
  type LineStateNode,
} from './graphs/line-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Line not found in state service */
export class MachineLineNotFoundError extends Schema.TaggedError<MachineLineNotFoundError>()(
  'MachineLineNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-95 line graph */
export class MachineLineInvalidTransitionError extends Schema.TaggedError<MachineLineInvalidTransitionError>()(
  'MachineLineInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineLineCreateError extends Schema.TaggedError<MachineLineCreateError>()(
  'MachineLineCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateLine extends Schema.TaggedRequest<InternalCreateLine>()(
  'InternalCreateLine',
  {
    failure: MachineLineCreateError,
    success: Line,
    payload: {
      params: CreateLineParams,
    },
  }
) {}

export class InternalGetLine extends Schema.TaggedRequest<InternalGetLine>()(
  'InternalGetLine',
  {
    failure: MachineLineNotFoundError,
    success: Line,
    payload: {
      lineId: Schema.String,
    },
  }
) {}

export class InternalUpdateLine extends Schema.TaggedRequest<InternalUpdateLine>()(
  'InternalUpdateLine',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineCreateError),
    success: Line,
    payload: {
      line: Line,
    },
  }
) {}

// =============================================================================
// Transition Requests
// =============================================================================

export class InternalStart extends Schema.TaggedRequest<InternalStart>()(
  'InternalStart',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalStop extends Schema.TaggedRequest<InternalStop>()(
  'InternalStop',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalBeginChangeover extends Schema.TaggedRequest<InternalBeginChangeover>()(
  'InternalBeginChangeover',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalCompleteChangeover extends Schema.TaggedRequest<InternalCompleteChangeover>()(
  'InternalCompleteChangeover',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalMarkStarved extends Schema.TaggedRequest<InternalMarkStarved>()(
  'InternalMarkStarved',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalClearStarved extends Schema.TaggedRequest<InternalClearStarved>()(
  'InternalClearStarved',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalMarkBlocked extends Schema.TaggedRequest<InternalMarkBlocked>()(
  'InternalMarkBlocked',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalClearBlocked extends Schema.TaggedRequest<InternalClearBlocked>()(
  'InternalClearBlocked',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalEnterMaintenance extends Schema.TaggedRequest<InternalEnterMaintenance>()(
  'InternalEnterMaintenance',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalCompleteMaintenance extends Schema.TaggedRequest<InternalCompleteMaintenance>()(
  'InternalCompleteMaintenance',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

export class InternalDecommissionLine extends Schema.TaggedRequest<InternalDecommissionLine>()(
  'InternalDecommissionLine',
  {
    failure: Schema.Union(MachineLineNotFoundError, MachineLineInvalidTransitionError),
    success: Line,
    payload: { lineId: Schema.String },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface LineMachineState {
  readonly mode: LineStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface LineMachineDeps {
  readonly state: LineStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Transition Procedure Helper
// =============================================================================

/**
 * Creates a standard transition procedure body for the LineMachine.
 * Reduces boilerplate across all graph-validated transitions.
 */
const makeTransitionProcedure = (
  state: LineStateShape,
  request: { lineId: string },
  targetState: LineStateNode,
  canTransition: (s: LineStateNode) => boolean,
  actionName: string
) =>
  Effect.gen(function* () {
    const line = yield* state.get(request.lineId as LineId).pipe(
      Effect.catchAll(() =>
        Effect.fail(new MachineLineNotFoundError({ entityId: request.lineId }))
      )
    )

    const currentState = line.status as LineStateNode

    if (!canTransition(currentState)) {
      return yield* Effect.fail(
        new MachineLineInvalidTransitionError({
          entityId: request.lineId,
          fromState: currentState,
          toState: targetState,
          message: `Cannot ${actionName} in state '${currentState}'.`,
        })
      )
    }

    const updated = new Line({ ...line, status: targetState })
    yield* state.set(updated)
    yield* Effect.logInfo(`[LineMachine] Line ${request.lineId} ${actionName}`)

    return [updated, { mode: targetState }] as const
  })

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a LineMachine with injected dependencies.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makeLineMachine = (deps: LineMachineDeps) =>
  Machine.make(
    (_input: void, previous?: LineMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        const initialState: LineMachineState = previous ?? { mode: 'idle' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateLine>()(
            'InternalCreateLine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const line = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineLineCreateError({ message: `Create line failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[LineMachine] Created line ${line.id}`)
                yield* Effect.logInfo(`[ES:Line] LineCreated`, { payload: { line } }).pipe(
                  Effect.catchAll((err) => Effect.logWarning(`Event emission failed: ${String(err)}`))
                )

                return [line, { mode: 'idle' as LineStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetLine>()(
            'InternalGetLine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const line = yield* state.get(request.lineId as LineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineLineNotFoundError({ entityId: request.lineId }))
                  )
                )

                return [line, { mode: line.status as LineStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateLine>()(
            'InternalUpdateLine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.line.id as LineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineLineNotFoundError({ entityId: request.line.id }))
                  )
                )

                yield* state.set(request.line).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineLineCreateError({ message: `Update line failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[LineMachine] Updated line ${request.line.id}`)

                return [request.line, { mode: request.line.status as LineStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // START (graph-validated): idle -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStart>()(
            'InternalStart',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canStart, 'start')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // STOP (graph-validated): running -> idle
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStop>()(
            'InternalStop',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'idle', canStop, 'stop')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // BEGIN CHANGEOVER (graph-validated): running -> changeover
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalBeginChangeover>()(
            'InternalBeginChangeover',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'changeover', canBeginChangeover, 'begin changeover')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE CHANGEOVER (graph-validated): changeover -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteChangeover>()(
            'InternalCompleteChangeover',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canCompleteChangeover, 'complete changeover')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK STARVED (graph-validated): running -> starved
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMarkStarved>()(
            'InternalMarkStarved',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'starved', canMarkStarved, 'mark starved')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR STARVED (graph-validated): starved -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearStarved>()(
            'InternalClearStarved',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canClearStarved, 'clear starved')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK BLOCKED (graph-validated): running -> blocked
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMarkBlocked>()(
            'InternalMarkBlocked',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'blocked', canMarkBlocked, 'mark blocked')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR BLOCKED (graph-validated): blocked -> running
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearBlocked>()(
            'InternalClearBlocked',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'running', canClearBlocked, 'clear blocked')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ENTER MAINTENANCE (graph-validated): idle|running -> maintenance
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalEnterMaintenance>()(
            'InternalEnterMaintenance',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'maintenance', canEnterMaintenance, 'enter maintenance')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE MAINTENANCE (graph-validated): maintenance -> idle
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteMaintenance>()(
            'InternalCompleteMaintenance',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'idle', canCompleteMaintenance, 'complete maintenance')
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (graph-validated): idle|maintenance -> decommissioned
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommissionLine>()(
            'InternalDecommissionLine',
            ({ state: _machineState, request }) =>
              makeTransitionProcedure(state, request, 'decommissioned', canDecommission, 'decommission')
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the LineMachine */
export type LineMachine = ReturnType<typeof makeLineMachine>

/** Type of the booted LineMachine actor */
export type LineMachineActor = Awaited<ReturnType<typeof Machine.boot<LineMachine>>>
