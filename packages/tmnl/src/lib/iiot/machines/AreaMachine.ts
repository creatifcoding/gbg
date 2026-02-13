/**
 * AreaMachine - Effect Machine for Area Lifecycle
 *
 * Internal actor-style state machine that wraps AreaState service.
 * Used by AreaEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 asset hierarchy)
 * - Non-blocking event emission via maybeEmitAsset
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * AreaEntity.toLayer()
 *   |-> Machine.boot(AreaMachine)
 *         |-> actor.send(InternalCreateArea)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> maybeEmitAsset() (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { AreaStateShape } from '../state/AreaState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Area, CreateAreaParams } from '../schemas/assets/area'
import type { AreaId } from '../schemas/identifiers'
import { maybeEmitAsset } from '../entity/_helpers'
import {
  canRestrict,
  canClearRestriction,
  canEnterMaintenance,
  canExitMaintenance,
  canDeactivate,
  canActivate,
  canDecommission,
  type AreaStateNode,
} from './graphs/area-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Area not found in state service */
export class MachineEntityNotFoundError extends Schema.TaggedError<MachineEntityNotFoundError>()(
  'MachineEntityNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per area graph */
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

export class InternalCreateArea extends Schema.TaggedRequest<InternalCreateArea>()(
  'InternalCreateArea',
  {
    failure: MachineCreateError,
    success: Area,
    payload: {
      params: CreateAreaParams,
    },
  }
) {}

export class InternalGetArea extends Schema.TaggedRequest<InternalGetArea>()(
  'InternalGetArea',
  {
    failure: MachineEntityNotFoundError,
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalRestrict extends Schema.TaggedRequest<InternalRestrict>()(
  'InternalRestrict',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalClearRestriction extends Schema.TaggedRequest<InternalClearRestriction>()(
  'InternalClearRestriction',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalEnterMaintenance extends Schema.TaggedRequest<InternalEnterMaintenance>()(
  'InternalEnterMaintenance',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalExitMaintenance extends Schema.TaggedRequest<InternalExitMaintenance>()(
  'InternalExitMaintenance',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalDeactivate extends Schema.TaggedRequest<InternalDeactivate>()(
  'InternalDeactivate',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalActivate extends Schema.TaggedRequest<InternalActivate>()(
  'InternalActivate',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

export class InternalDecommission extends Schema.TaggedRequest<InternalDecommission>()(
  'InternalDecommission',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Area,
    payload: {
      areaId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface AreaMachineState {
  readonly mode: AreaStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface AreaMachineDeps {
  readonly state: AreaStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create an AreaMachine with injected dependencies.
 *
 * The machine wraps the AreaState service and validates
 * all state transitions via the area state graph.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makeAreaMachine = (deps: AreaMachineDeps) =>
  Machine.make(
    (_input: void, previous?: AreaMachineState) =>
      Effect.gen(function* () {
        const { state, flags } = deps

        const initialState: AreaMachineState = previous ?? { mode: 'active' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateArea>()(
            'InternalCreateArea',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineCreateError({ message: `Create area failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[AreaMachine] Created area ${area.id}`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaCreated', { area })

                return [area, { mode: 'active' as AreaStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetArea>()(
            'InternalGetArea',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                return [area, { mode: area.status as AreaStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RESTRICT (active -> restricted)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalRestrict>()(
            'InternalRestrict',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'restricted'

                if (!canRestrict(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot restrict area in state '${currentState}'. Area must be in 'active' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'restricted',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} restricted`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaRestricted', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR RESTRICTION (restricted -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClearRestriction>()(
            'InternalClearRestriction',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'active'

                if (!canClearRestriction(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot clear restriction in state '${currentState}'. Area must be in 'restricted' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'active',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} restriction cleared`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaRestrictionCleared', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ENTER MAINTENANCE (active -> maintenance)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalEnterMaintenance>()(
            'InternalEnterMaintenance',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'maintenance'

                if (!canEnterMaintenance(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot enter maintenance in state '${currentState}'. Area must be in 'active' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'maintenance',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} entered maintenance`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaMaintenanceEntered', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // EXIT MAINTENANCE (maintenance -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalExitMaintenance>()(
            'InternalExitMaintenance',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'active'

                if (!canExitMaintenance(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot exit maintenance in state '${currentState}'. Area must be in 'maintenance' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'active',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} exited maintenance`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaMaintenanceExited', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DEACTIVATE (active -> inactive)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDeactivate>()(
            'InternalDeactivate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'inactive'

                if (!canDeactivate(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot deactivate area in state '${currentState}'. Area must be in 'active' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'inactive',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} deactivated`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaDeactivated', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ACTIVATE (inactive -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalActivate>()(
            'InternalActivate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'active'

                if (!canActivate(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot activate area in state '${currentState}'. Area must be in 'inactive' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'active',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} activated`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaActivated', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (inactive|maintenance -> decommissioned, terminal)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommission>()(
            'InternalDecommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const area = yield* state.get(request.areaId as AreaId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.areaId }))
                  )
                )

                const currentState = area.status as AreaStateNode
                const targetState: AreaStateNode = 'decommissioned'

                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.areaId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot decommission area in state '${currentState}'. Area must be in 'inactive' or 'maintenance' state.`,
                    })
                  )
                }

                const updated = new Area({
                  ...area,
                  status: 'decommissioned',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[AreaMachine] Area ${request.areaId} decommissioned`)
                yield* maybeEmitAsset(flags, 'Area', 'AreaDecommissioned', { area: updated })

                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the AreaMachine */
export type AreaMachine = ReturnType<typeof makeAreaMachine>

/** Type of the booted AreaMachine actor */
export type AreaMachineActor = Awaited<ReturnType<typeof Machine.boot<AreaMachine>>>
