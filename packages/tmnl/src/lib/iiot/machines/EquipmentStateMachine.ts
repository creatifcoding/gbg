/**
 * EquipmentStateMachine - Effect Machine for Equipment State & OEE
 *
 * Internal actor-style state machine that wraps EquipmentStateService.
 * Used by EquipmentStateEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 / OEE compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for state tracking and OEE calculations
 *
 * Architecture:
 * ```
 * EquipmentStateEntity.toLayer()
 *   └─▶ Machine.boot(EquipmentStateMachine)
 *         └─▶ actor.send(InternalTransition)
 *               └─▶ Machine.procedures.add() handler
 *                     └─▶ state.create/get/set (StateService)
 *                     └─▶ maybeEmitEquipment() (EventLog)
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
import type { EquipmentStateShapeInterface, EquipmentStateFilter } from '../state/StateShape'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import type { DomainEventEmitterShape } from '../services/events'
import {
  EquipmentState,
  EquipmentStateId,
  StateType,
  StateReason,
  StateDurationAggregate,
} from '../schemas/equipment-state/schema'
import { MachineId, PropagationId } from '../schemas/identifiers'
import {
  isValidEquipmentTransition,
  getTransitionAction,
  type EquipmentStateNode,
} from './graphs/equipment-state-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Equipment state not found in state service */
export class MachineEquipmentStateNotFoundError extends Schema.TaggedError<MachineEquipmentStateNotFoundError>()(
  'MachineEquipmentStateNotFoundError',
  {
    stateId: Schema.String,
  }
) {}

/** Machine has no current state */
export class MachineMachineStateNotFoundError extends Schema.TaggedError<MachineMachineStateNotFoundError>()(
  'MachineMachineStateNotFoundError',
  {
    machineId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-95 / OEE graph */
export class MachineEquipmentTransitionError extends Schema.TaggedError<MachineEquipmentTransitionError>()(
  'MachineEquipmentTransitionError',
  {
    machineId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** OEE calculation error */
export class MachineOeeCalculationError extends Schema.TaggedError<MachineOeeCalculationError>()(
  'MachineOeeCalculationError',
  {
    machineId: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

/**
 * Internal request to get current equipment state for a machine.
 */
export class InternalGetCurrent extends Schema.TaggedRequest<InternalGetCurrent>()(
  'InternalGetCurrent',
  {
    failure: MachineMachineStateNotFoundError,
    success: EquipmentState,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

/**
 * Internal request to get equipment state history for a machine.
 */
export class InternalGetHistory extends Schema.TaggedRequest<InternalGetHistory>()(
  'InternalGetHistory',
  {
    failure: MachineMachineStateNotFoundError,
    success: Schema.Array(EquipmentState),
    payload: {
      machineId: Schema.String,
      since: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
      until: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
      limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
    },
  }
) {}

/**
 * Internal request to transition machine to a new state (graph-validated).
 */
export class InternalTransition extends Schema.TaggedRequest<InternalTransition>()(
  'InternalTransition',
  {
    failure: Schema.Union(MachineMachineStateNotFoundError, MachineEquipmentTransitionError),
    success: EquipmentState,
    payload: {
      machineId: Schema.String,
      newState: StateType,
      reason: Schema.optionalWith(StateReason, { as: 'Option' }),
      operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),
      notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
    },
  }
) {}

/**
 * Internal request to update reason for current state.
 */
export class InternalUpdateReason extends Schema.TaggedRequest<InternalUpdateReason>()(
  'InternalUpdateReason',
  {
    failure: MachineEquipmentStateNotFoundError,
    success: EquipmentState,
    payload: {
      stateId: EquipmentStateId,
      reason: StateReason,
      notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
    },
  }
) {}

/**
 * Internal request to calculate OEE for a machine over a time period.
 */
export class InternalGetOee extends Schema.TaggedRequest<InternalGetOee>()(
  'InternalGetOee',
  {
    failure: Schema.Union(MachineMachineStateNotFoundError, MachineOeeCalculationError),
    success: Schema.Struct({
      machineId: MachineId,
      periodStart: Schema.DateTimeUtc,
      periodEnd: Schema.DateTimeUtc,
      availability: Schema.Number,
      performance: Schema.Number,
      quality: Schema.Number,
      oee: Schema.Number,
      breakdown: StateDurationAggregate,
    }),
    payload: {
      machineId: Schema.String,
      since: Schema.DateTimeUtc,
      until: Schema.DateTimeUtc,
      theoreticalOutputPerHour: Schema.optionalWith(Schema.Number, { as: 'Option' }),
      goodPartsProduced: Schema.optionalWith(Schema.Number, { as: 'Option' }),
      totalPartsProduced: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    },
  }
) {}

/**
 * Internal request to get state durations aggregated by type.
 */
export class InternalGetDurations extends Schema.TaggedRequest<InternalGetDurations>()(
  'InternalGetDurations',
  {
    failure: MachineMachineStateNotFoundError,
    success: StateDurationAggregate,
    payload: {
      machineId: Schema.String,
      since: Schema.DateTimeUtc,
      until: Schema.DateTimeUtc,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

/**
 * Internal machine state tracking current equipment state mode.
 */
export interface EquipmentStateMachineState {
  /** Current operational mode (tracks last known equipment state) */
  readonly mode: EquipmentStateNode
  /** Current machine being tracked */
  readonly currentMachineId: string | null
}

// =============================================================================
// Dependencies Interface
// =============================================================================

/**
 * Dependencies required to construct the EquipmentStateMachine.
 * Injected via Entity.toLayer() Effect.gen.
 */
export interface EquipmentStateMachineDeps {
  /** State service port for equipment state persistence */
  readonly state: EquipmentStateShapeInterface
  /** Feature flags for event emission control */
  readonly flags: FeatureFlagsShape
  /** Optional durable/realtime domain event emitter */
  readonly eventEmitter?: DomainEventEmitterShape
  /** Optional SQL client; when present transition state + durable event writes share one transaction. */
  readonly sql?: SqlClient.SqlClient
}

// =============================================================================
// Event Emission Helper
// =============================================================================

const makePropagationId = (): PropagationId =>
  `PROP-${Date.now()}-${Math.random().toString(36).slice(2)}` as PropagationId

/**
 * Conditionally emit equipment state events based on feature flags.
 */
const maybeEmitEquipmentEvent = (
  flags: FeatureFlagsShape,
  eventEmitter: DomainEventEmitterShape | undefined,
  eventType: string,
  payload: Record<string, unknown>
) =>
  Effect.gen(function* () {
    if (!flags.equipmentStateEventSourcingEnabled) return

    if (!eventEmitter) {
      yield* Effect.logWarning(`[EquipmentStateMachine] Skipping ${eventType}: DomainEventEmitter not provided`)
      return
    }

    if (eventType !== 'EquipmentStateChanged') {
      yield* Effect.logWarning(`[EquipmentStateMachine] Skipping unsupported event ${eventType}`)
      return
    }

    yield* eventEmitter.emitEquipmentStateChangedStrict({
      machineId: payload['machineId'] as never,
      previousState: String(payload['fromState']),
      newState: String(payload['toState']),
      reason: typeof payload['reason'] === 'string' ? payload['reason'] : undefined,
      triggeredBy: typeof payload['operatorId'] === 'string' ? payload['operatorId'] : undefined,
      propagationId: typeof payload['propagationId'] === 'string'
        ? payload['propagationId'] as PropagationId
        : undefined,
    })
  })

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create an EquipmentStateMachine with injected dependencies.
 *
 * The machine wraps the EquipmentStateService and validates
 * all state transitions via the ISA-95 / OEE state graph.
 */
export const makeEquipmentStateMachine = (deps: EquipmentStateMachineDeps) =>
  Machine.make(
    (_input: void, previous?: EquipmentStateMachineState) =>
      Effect.gen(function* () {
        const { state, flags, eventEmitter, sql } = deps
        const transactionally = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          sql ? sql.withTransaction(effect) : effect

        // Initial machine state
        const initialState: EquipmentStateMachineState = previous ?? {
          mode: 'idle',
          currentMachineId: null,
        }

        return Machine.procedures.make(initialState).pipe(
          // ─────────────────────────────────────────────────────────────────────
          // GET CURRENT
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetCurrent>()(
            'InternalGetCurrent',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const current = yield* state.getCurrent(request.machineId as MachineId)

                if (Option.isNone(current)) {
                  return yield* Effect.fail(
                    new MachineMachineStateNotFoundError({ machineId: request.machineId })
                  )
                }

                const equipmentState = current.value

                return [
                  equipmentState,
                  {
                    ...machineState,
                    mode: equipmentState.state as EquipmentStateNode,
                    currentMachineId: request.machineId,
                  },
                ] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET HISTORY
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetHistory>()(
            'InternalGetHistory',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const { machineId, since, until, limit } = request

                const filter: EquipmentStateFilter = {
                  machineId: machineId as MachineId,
                  since: Option.isSome(since) ? new Date(Number(since.value.epochMillis)) : undefined,
                  until: Option.isSome(until) ? new Date(Number(until.value.epochMillis)) : undefined,
                  limit,
                }

                const states = yield* state.list(filter)

                if (states.length === 0) {
                  return yield* Effect.fail(
                    new MachineMachineStateNotFoundError({ machineId })
                  )
                }

                return [states as readonly EquipmentState[], machineState] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // TRANSITION (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalTransition>()(
            'InternalTransition',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const { machineId, newState, reason, operatorId, notes } = request
                const now = yield* DateTime.now

                // Get current state to validate transition
                const currentOpt = yield* state.getCurrent(machineId as MachineId)
                const currentState: EquipmentStateNode = Option.isSome(currentOpt)
                  ? (currentOpt.value.state as EquipmentStateNode)
                  : 'idle' // Default to idle if no current state

                const targetState = newState as EquipmentStateNode

                // Validate transition if we have an existing state
                if (Option.isSome(currentOpt)) {
                  if (!isValidEquipmentTransition(currentState, targetState)) {
                    const action = getTransitionAction(currentState, targetState)
                    return yield* Effect.fail(
                      new MachineEquipmentTransitionError({
                        machineId,
                        fromState: currentState,
                        toState: targetState,
                        message: `Invalid transition from '${currentState}' to '${targetState}'. ${
                          Option.isNone(action)
                            ? 'No valid action exists for this transition.'
                            : ''
                        }`,
                      })
                    )
                  }
                }

                const newEquipmentState = yield* transactionally(
                  Effect.gen(function* () {
                    const propagationId = makePropagationId()

                    if (Option.isSome(currentOpt)) {
                      yield* state.endCurrent(machineId as MachineId, new Date(Number(now.epochMillis)))
                    }

                    const created = yield* state.create({
                      machineId: machineId as MachineId,
                      state: newState,
                      reason,
                      operatorId,
                      notes,
                    })

                    yield* maybeEmitEquipmentEvent(flags, eventEmitter, 'EquipmentStateChanged', {
                      machineId,
                      fromState: currentState,
                      toState: targetState,
                      reason: Option.isSome(reason) ? reason.value : undefined,
                      operatorId: Option.isSome(operatorId) ? operatorId.value : undefined,
                      equipmentState: created,
                      propagationId,
                    })

                    return created
                  })
                )

                yield* Effect.logInfo(
                  `[EquipmentStateMachine] Machine ${machineId} transitioned from ${currentState} to ${targetState}`
                )

                return [
                  newEquipmentState,
                  {
                    ...machineState,
                    mode: targetState,
                    currentMachineId: machineId,
                  },
                ] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE REASON
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateReason>()(
            'InternalUpdateReason',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const { stateId, reason, notes } = request

                const existing = yield* state.get(stateId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEquipmentStateNotFoundError({ stateId: stateId as string }))
                  )
                )

                const updated = new EquipmentState({
                  ...existing,
                  reason: Option.some(reason),
                  notes: Option.isSome(notes) ? notes : existing.notes,
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[EquipmentStateMachine] Updated reason for state ${stateId}`)

                return [updated, machineState] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET OEE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetOee>()(
            'InternalGetOee',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const {
                  machineId,
                  since,
                  until,
                  theoreticalOutputPerHour,
                  goodPartsProduced,
                  totalPartsProduced,
                } = request

                // Get state history in period
                const states = yield* state.list({
                  machineId: machineId as MachineId,
                  since: new Date(Number(since.epochMillis)),
                  until: new Date(Number(until.epochMillis)),
                })

                if (states.length === 0) {
                  return yield* Effect.fail(
                    new MachineMachineStateNotFoundError({ machineId })
                  )
                }

                // Calculate durations by state type
                const durations = {
                  running: 0,
                  idle: 0,
                  planned_downtime: 0,
                  unplanned_downtime: 0,
                  setup: 0,
                  blocked: 0,
                }

                const periodEnd = Number(until.epochMillis)
                for (const s of states) {
                  const start = Number(s.startedAt.epochMillis)
                  const end = Option.isSome(s.endedAt)
                    ? Number(s.endedAt.value.epochMillis)
                    : periodEnd
                  const stateKey = s.state as keyof typeof durations
                  durations[stateKey] += end - start
                }

                const totalTime =
                  durations['running'] +
                  durations['idle'] +
                  durations['planned_downtime'] +
                  durations['unplanned_downtime'] +
                  durations['setup'] +
                  durations['blocked']

                // Availability = (Running + Idle + Setup + Blocked) / (Total - Planned Downtime)
                const scheduledTime = totalTime - durations['planned_downtime']
                const availability =
                  scheduledTime > 0
                    ? (durations['running'] + durations['idle'] + durations['setup'] + durations['blocked']) /
                      scheduledTime
                    : 0

                // Performance = Actual / Theoretical (default to 1 if not provided)
                const performance =
                  Option.isSome(theoreticalOutputPerHour) && Option.isSome(goodPartsProduced)
                    ? goodPartsProduced.value /
                      (theoreticalOutputPerHour.value * (durations['running'] / 3600000))
                    : 1

                // Quality = Good / Total (default to 1 if not provided)
                const quality =
                  Option.isSome(goodPartsProduced) &&
                  Option.isSome(totalPartsProduced) &&
                  totalPartsProduced.value > 0
                    ? goodPartsProduced.value / totalPartsProduced.value
                    : 1

                const oee = availability * performance * quality

                // Create proper StateDurationAggregate for breakdown
                const breakdown = new StateDurationAggregate({
                  machineId: machineId as MachineId,
                  periodStart: since,
                  periodEnd: until,
                  runningMs: durations['running'],
                  idleMs: durations['idle'],
                  plannedDowntimeMs: durations['planned_downtime'],
                  unplannedDowntimeMs: durations['unplanned_downtime'],
                  setupMs: durations['setup'],
                  blockedMs: durations['blocked'],
                  transitionCount: states.length - 1,
                })

                const result = {
                  machineId: machineId as MachineId,
                  periodStart: since,
                  periodEnd: until,
                  availability: Math.min(1, Math.max(0, availability)),
                  performance: Math.min(1, Math.max(0, performance)),
                  quality: Math.min(1, Math.max(0, quality)),
                  oee: Math.min(1, Math.max(0, oee)),
                  breakdown,
                }

                return [result, machineState] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET DURATIONS
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetDurations>()(
            'InternalGetDurations',
            ({ state: machineState, request }) =>
              Effect.gen(function* () {
                const { machineId, since, until } = request

                const states = yield* state.list({
                  machineId: machineId as MachineId,
                  since: new Date(Number(since.epochMillis)),
                  until: new Date(Number(until.epochMillis)),
                })

                if (states.length === 0) {
                  return yield* Effect.fail(
                    new MachineMachineStateNotFoundError({ machineId })
                  )
                }

                // Calculate durations by state type
                const durations = {
                  running: 0,
                  idle: 0,
                  planned_downtime: 0,
                  unplanned_downtime: 0,
                  setup: 0,
                  blocked: 0,
                }

                const periodEnd = Number(until.epochMillis)
                for (const s of states) {
                  const start = Number(s.startedAt.epochMillis)
                  const end = Option.isSome(s.endedAt)
                    ? Number(s.endedAt.value.epochMillis)
                    : periodEnd
                  const stateKey = s.state as keyof typeof durations
                  durations[stateKey] += end - start
                }

                // Return as StateDurationAggregate
                const aggregate = new StateDurationAggregate({
                  machineId: machineId as MachineId,
                  periodStart: since,
                  periodEnd: until,
                  runningMs: durations['running'],
                  idleMs: durations['idle'],
                  plannedDowntimeMs: durations['planned_downtime'],
                  unplannedDowntimeMs: durations['unplanned_downtime'],
                  setupMs: durations['setup'],
                  blockedMs: durations['blocked'],
                  transitionCount: states.length - 1,
                })

                return [aggregate, machineState] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the EquipmentStateMachine */
export type EquipmentStateMachine = ReturnType<typeof makeEquipmentStateMachine>

/** Type of the booted EquipmentStateMachine actor */
export type EquipmentStateMachineActor = Awaited<ReturnType<typeof Machine.boot<EquipmentStateMachine>>>
