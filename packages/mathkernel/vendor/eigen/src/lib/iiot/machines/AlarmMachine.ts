/**
 * AlarmMachine - Effect Machine for Alarm Lifecycle
 *
 * Internal actor-style state machine that wraps AlarmState service.
 * Used by AlarmEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-18.2 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * AlarmEntity.toLayer()
 *   └─▶ Machine.boot(AlarmMachine)
 *         └─▶ actor.send(InternalCreateAlarm)
 *               └─▶ Machine.procedures.add() handler
 *                     └─▶ state.create/get/set (StateService)
 *                     └─▶ maybeEmitAlarm() (EventLog)
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

import { Schema, Effect, DateTime, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { AlarmStateShape } from '../state/StateShape'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Alarm, AlarmState as AlarmStateType, CreateAlarmParams } from '../schemas/alarms'
import type { AlarmId } from '../schemas/identifiers'
import { maybeEmitAlarm } from '../entity/_helpers'
import {
  canAcknowledgeAlarm,
  canClearAlarm,
  type AlarmStateNode,
} from './graphs/alarm-state-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Alarm not found in state service */
export class MachineAlarmNotFoundError extends Schema.TaggedError<MachineAlarmNotFoundError>()(
  'MachineAlarmNotFoundError',
  {
    alarmId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-18.2 graph */
export class MachineInvalidTransitionError extends Schema.TaggedError<MachineInvalidTransitionError>()(
  'MachineInvalidTransitionError',
  {
    alarmId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineCreateError extends Schema.TaggedError<MachineCreateError>()(
  'MachineCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

/**
 * Internal request to create an alarm.
 * Not exposed as RPC — used for Machine procedure delegation.
 */
export class InternalCreateAlarm extends Schema.TaggedRequest<InternalCreateAlarm>()(
  'InternalCreateAlarm',
  {
    failure: MachineCreateError,
    success: Alarm,
    payload: {
      params: CreateAlarmParams,
    },
  }
) {}

/**
 * Internal request to get an alarm by ID.
 */
export class InternalGetAlarm extends Schema.TaggedRequest<InternalGetAlarm>()(
  'InternalGetAlarm',
  {
    failure: MachineAlarmNotFoundError,
    success: Alarm,
    payload: {
      alarmId: Schema.String,
    },
  }
) {}

/**
 * Internal request to acknowledge an alarm.
 */
export class InternalAcknowledgeAlarm extends Schema.TaggedRequest<InternalAcknowledgeAlarm>()(
  'InternalAcknowledgeAlarm',
  {
    failure: Schema.Union(MachineAlarmNotFoundError, MachineInvalidTransitionError),
    success: Alarm,
    payload: {
      alarmId: Schema.String,
      acknowledgedBy: Schema.String,
    },
  }
) {}

/**
 * Internal request to clear an alarm.
 */
export class InternalClearAlarm extends Schema.TaggedRequest<InternalClearAlarm>()(
  'InternalClearAlarm',
  {
    failure: Schema.Union(MachineAlarmNotFoundError, MachineInvalidTransitionError),
    success: Alarm,
    payload: {
      alarmId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

/**
 * Internal machine state tracking current alarm mode.
 * This is separate from the persisted Alarm state — it tracks
 * the Machine's procedure context.
 */
export interface AlarmMachineState {
  /** Current operational mode (tracks last known alarm state) */
  readonly mode: AlarmStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

/**
 * Dependencies required to construct the AlarmMachine.
 * Injected via Entity.toLayer() Effect.gen.
 */
export interface AlarmMachineDeps {
  /** State service port for alarm persistence */
  readonly state: AlarmStateShape
  /** Feature flags for event emission control */
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create an AlarmMachine with injected dependencies.
 *
 * The machine wraps the AlarmState service and validates
 * all state transitions via the ISA-18.2 state graph.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 *
 * @example
 * ```typescript
 * // Inside Entity.toLayer()
 * const state = yield* AlarmState
 * const flags = yield* IIoTFeatureFlags
 * const machine = makeAlarmMachine({ state, flags })
 * const actor = yield* Machine.boot(machine)
 *
 * // Handlers delegate to actor
 * const handleCreate = (envelope) =>
 *   actor.send(new InternalCreateAlarm({ params: envelope.payload }))
 * ```
 */
export const makeAlarmMachine = (deps: AlarmMachineDeps) =>
  Machine.make(
    // Initialize function: receives optional previous state
    (_input: void, previous?: AlarmMachineState) =>
      Effect.gen(function* () {
        const { state, flags } = deps

        // Initial machine state (unacknowledged is the starting state for new alarms)
        const initialState: AlarmMachineState = previous ?? { mode: 'unacknowledged' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateAlarm>()(
            'InternalCreateAlarm',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const alarm = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineCreateError({ message: `Create alarm failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[AlarmMachine] Created alarm ${alarm.id}`)
                yield* maybeEmitAlarm(flags, 'AlarmTriggered', { alarm })

                // Return [result, newMachineState]
                return [alarm, { mode: 'unacknowledged' as AlarmStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetAlarm>()(
            'InternalGetAlarm',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const alarm = yield* state.get(request.alarmId as AlarmId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineAlarmNotFoundError({ alarmId: request.alarmId }))
                  )
                )

                // Update machine state to reflect fetched alarm's state
                return [alarm, { mode: alarm.state as AlarmStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ACKNOWLEDGE (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalAcknowledgeAlarm>()(
            'InternalAcknowledgeAlarm',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                // Get current alarm (recover not-found to typed error)
                const alarm = yield* state.get(request.alarmId as AlarmId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineAlarmNotFoundError({ alarmId: request.alarmId }))
                  )
                )

                // Validate transition using graph
                const currentState = alarm.state as AlarmStateNode
                const targetState: AlarmStateNode = 'acknowledged'

                if (!canAcknowledgeAlarm(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      alarmId: request.alarmId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot acknowledge alarm in state '${currentState}'. Alarm must be in 'unacknowledged' state.`,
                    })
                  )
                }

                // Perform the transition
                const now = yield* DateTime.now
                const acknowledged = new Alarm({
                  ...alarm,
                  state: 'acknowledged' as AlarmStateType,
                  acknowledgedAt: now,
                  acknowledgedBy: request.acknowledgedBy,
                })

                yield* state.set(acknowledged)
                yield* Effect.logInfo(
                  `[AlarmMachine] Alarm ${request.alarmId} acknowledged by ${request.acknowledgedBy}`
                )
                yield* maybeEmitAlarm(flags, 'AlarmAcknowledged', {
                  alarm: acknowledged,
                  acknowledgedBy: request.acknowledgedBy,
                })

                return [acknowledged, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR (graph-validated)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearAlarm>()(
            'InternalClearAlarm',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                // Get current alarm (recover not-found to typed error)
                const alarm = yield* state.get(request.alarmId as AlarmId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineAlarmNotFoundError({ alarmId: request.alarmId }))
                  )
                )

                // Validate transition using graph
                const currentState = alarm.state as AlarmStateNode
                const targetState: AlarmStateNode = 'cleared'

                if (!canClearAlarm(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      alarmId: request.alarmId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot clear alarm in state '${currentState}'. Alarm must be in 'acknowledged' state.`,
                    })
                  )
                }

                // Perform the transition
                const now = yield* DateTime.now
                const cleared = new Alarm({
                  ...alarm,
                  state: 'cleared' as AlarmStateType,
                  clearedAt: now,
                })

                yield* state.set(cleared)
                yield* Effect.logInfo(`[AlarmMachine] Alarm ${request.alarmId} cleared`)
                yield* maybeEmitAlarm(flags, 'AlarmCleared', { alarm: cleared })

                return [cleared, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the AlarmMachine */
export type AlarmMachine = ReturnType<typeof makeAlarmMachine>

/** Type of the booted AlarmMachine actor */
export type AlarmMachineActor = Awaited<ReturnType<typeof Machine.boot<AlarmMachine>>>
