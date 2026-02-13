/**
 * EnterpriseMachine - Effect Machine for Enterprise Lifecycle
 *
 * Internal actor-style state machine that wraps EnterpriseState service.
 * Used by EnterpriseEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 asset hierarchy)
 * - Non-blocking event emission via maybeEmitAsset
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * EnterpriseEntity.toLayer()
 *   |-> Machine.boot(EnterpriseMachine)
 *         |-> actor.send(InternalCreateEnterprise)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> maybeEmitAsset() (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { EnterpriseStateShape } from '../state/EnterpriseState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Enterprise, CreateEnterpriseParams } from '../schemas/assets/enterprise'
import type { EnterpriseId } from '../schemas/identifiers'
import { maybeEmitAsset } from '../entity/_helpers'
import {
  canRestructure,
  canCompleteRestructuring,
  canMerge,
  canDissolve,
  type EnterpriseStateNode,
} from './graphs/enterprise-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Enterprise not found in state service */
export class MachineEntityNotFoundError extends Schema.TaggedError<MachineEntityNotFoundError>()(
  'MachineEntityNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per enterprise graph */
export class MachineInvalidTransitionError extends Schema.TaggedError<MachineInvalidTransitionError>()(
  'MachineInvalidTransitionError',
  {
    entityId: Schema.String,
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
 * Internal request to create an enterprise.
 * Not exposed as RPC -- used for Machine procedure delegation.
 */
export class InternalCreateEnterprise extends Schema.TaggedRequest<InternalCreateEnterprise>()(
  'InternalCreateEnterprise',
  {
    failure: MachineCreateError,
    success: Enterprise,
    payload: {
      params: CreateEnterpriseParams,
    },
  }
) {}

/**
 * Internal request to get an enterprise by ID.
 */
export class InternalGetEnterprise extends Schema.TaggedRequest<InternalGetEnterprise>()(
  'InternalGetEnterprise',
  {
    failure: MachineEntityNotFoundError,
    success: Enterprise,
    payload: {
      enterpriseId: Schema.String,
    },
  }
) {}

/**
 * Internal request to restructure an enterprise (active -> restructuring).
 */
export class InternalRestructure extends Schema.TaggedRequest<InternalRestructure>()(
  'InternalRestructure',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Enterprise,
    payload: {
      enterpriseId: Schema.String,
    },
  }
) {}

/**
 * Internal request to complete restructuring (restructuring -> active).
 */
export class InternalCompleteRestructuring extends Schema.TaggedRequest<InternalCompleteRestructuring>()(
  'InternalCompleteRestructuring',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Enterprise,
    payload: {
      enterpriseId: Schema.String,
    },
  }
) {}

/**
 * Internal request to merge an enterprise (active -> merged, terminal).
 */
export class InternalMerge extends Schema.TaggedRequest<InternalMerge>()(
  'InternalMerge',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Enterprise,
    payload: {
      enterpriseId: Schema.String,
    },
  }
) {}

/**
 * Internal request to dissolve an enterprise (active|restructuring -> dissolved, terminal).
 */
export class InternalDissolve extends Schema.TaggedRequest<InternalDissolve>()(
  'InternalDissolve',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Enterprise,
    payload: {
      enterpriseId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

/**
 * Internal machine state tracking current enterprise mode.
 * This is separate from the persisted Enterprise state -- it tracks
 * the Machine's procedure context.
 */
export interface EnterpriseMachineState {
  /** Current operational mode (tracks last known enterprise state) */
  readonly mode: EnterpriseStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

/**
 * Dependencies required to construct the EnterpriseMachine.
 * Injected via Entity.toLayer() Effect.gen.
 */
export interface EnterpriseMachineDeps {
  /** State service port for enterprise persistence */
  readonly state: EnterpriseStateShape
  /** Feature flags for event emission control */
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create an EnterpriseMachine with injected dependencies.
 *
 * The machine wraps the EnterpriseState service and validates
 * all state transitions via the enterprise state graph.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makeEnterpriseMachine = (deps: EnterpriseMachineDeps) =>
  Machine.make(
    (_input: void, previous?: EnterpriseMachineState) =>
      Effect.gen(function* () {
        const { state, flags } = deps

        // Initial machine state (active is the starting state for new enterprises)
        const initialState: EnterpriseMachineState = previous ?? { mode: 'active' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateEnterprise>()(
            'InternalCreateEnterprise',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineCreateError({ message: `Create enterprise failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[EnterpriseMachine] Created enterprise ${enterprise.id}`)
                yield* maybeEmitAsset(flags, 'Enterprise', 'EnterpriseCreated', { enterprise })

                return [enterprise, { mode: 'active' as EnterpriseStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetEnterprise>()(
            'InternalGetEnterprise',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.get(request.enterpriseId as EnterpriseId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.enterpriseId }))
                  )
                )

                return [enterprise, { mode: enterprise.status as EnterpriseStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RESTRUCTURE (graph-validated: active -> restructuring)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalRestructure>()(
            'InternalRestructure',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.get(request.enterpriseId as EnterpriseId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.enterpriseId }))
                  )
                )

                const currentState = enterprise.status as EnterpriseStateNode
                const targetState: EnterpriseStateNode = 'restructuring'

                if (!canRestructure(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.enterpriseId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot restructure enterprise in state '${currentState}'. Enterprise must be in 'active' state.`,
                    })
                  )
                }

                const updated = new Enterprise({
                  ...enterprise,
                  status: 'restructuring',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[EnterpriseMachine] Enterprise ${request.enterpriseId} restructuring`)
                yield* maybeEmitAsset(flags, 'Enterprise', 'EnterpriseRestructured', { enterprise: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE RESTRUCTURING (graph-validated: restructuring -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteRestructuring>()(
            'InternalCompleteRestructuring',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.get(request.enterpriseId as EnterpriseId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.enterpriseId }))
                  )
                )

                const currentState = enterprise.status as EnterpriseStateNode
                const targetState: EnterpriseStateNode = 'active'

                if (!canCompleteRestructuring(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.enterpriseId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot complete restructuring in state '${currentState}'. Enterprise must be in 'restructuring' state.`,
                    })
                  )
                }

                const updated = new Enterprise({
                  ...enterprise,
                  status: 'active',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[EnterpriseMachine] Enterprise ${request.enterpriseId} restructuring complete`)
                yield* maybeEmitAsset(flags, 'Enterprise', 'EnterpriseRestructuringCompleted', { enterprise: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MERGE (graph-validated: active -> merged, terminal)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMerge>()(
            'InternalMerge',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.get(request.enterpriseId as EnterpriseId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.enterpriseId }))
                  )
                )

                const currentState = enterprise.status as EnterpriseStateNode
                const targetState: EnterpriseStateNode = 'merged'

                if (!canMerge(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.enterpriseId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot merge enterprise in state '${currentState}'. Enterprise must be in 'active' state.`,
                    })
                  )
                }

                const updated = new Enterprise({
                  ...enterprise,
                  status: 'merged',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[EnterpriseMachine] Enterprise ${request.enterpriseId} merged`)
                yield* maybeEmitAsset(flags, 'Enterprise', 'EnterpriseMerged', { enterprise: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DISSOLVE (graph-validated: active|restructuring -> dissolved, terminal)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDissolve>()(
            'InternalDissolve',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const enterprise = yield* state.get(request.enterpriseId as EnterpriseId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.enterpriseId }))
                  )
                )

                const currentState = enterprise.status as EnterpriseStateNode
                const targetState: EnterpriseStateNode = 'dissolved'

                if (!canDissolve(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.enterpriseId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot dissolve enterprise in state '${currentState}'. Enterprise must be in 'active' or 'restructuring' state.`,
                    })
                  )
                }

                const updated = new Enterprise({
                  ...enterprise,
                  status: 'dissolved',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[EnterpriseMachine] Enterprise ${request.enterpriseId} dissolved`)
                yield* maybeEmitAsset(flags, 'Enterprise', 'EnterpriseDissolved', { enterprise: updated })

                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the EnterpriseMachine */
export type EnterpriseMachine = ReturnType<typeof makeEnterpriseMachine>

/** Type of the booted EnterpriseMachine actor */
export type EnterpriseMachineActor = Awaited<ReturnType<typeof Machine.boot<EnterpriseMachine>>>
