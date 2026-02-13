/**
 * MachineAssetMachine - Effect Machine for Machine Asset Lifecycle
 *
 * Internal actor-style state machine that wraps MachineState service.
 * Used by MachineAssetEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * MachineAssetEntity.toLayer()
 *   └──▶ Machine.boot(MachineAssetMachine)
 *         └──▶ actor.send(InternalCreateMachine)
 *               └──▶ Machine.procedures.add() handler
 *                     └──▶ state.create/get/set (StateService)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { MachineStateShape } from '../state/MachineState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Machine as MachineAsset, CreateMachineParams } from '../schemas/assets/machine'
import type { MachineId } from '../schemas/identifiers'
import {
  canActivate,
  canGoIdle,
  canResume,
  canMarkFaulted,
  canScheduleRepair,
  canEmergencyRepair,
  canScheduleMaintenance,
  canCompleteMaintenance,
  canRetire,
  canDecommission,
  type MachineAssetStateNode,
} from './graphs/machine-asset-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Machine asset not found in state service */
export class MachineMachineAssetNotFoundError extends Schema.TaggedError<MachineMachineAssetNotFoundError>()(
  'MachineMachineAssetNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-95 graph */
export class MachineMachineAssetInvalidTransitionError extends Schema.TaggedError<MachineMachineAssetInvalidTransitionError>()(
  'MachineMachineAssetInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineAssetCreateError extends Schema.TaggedError<MachineAssetCreateError>()(
  'MachineAssetCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateMachine extends Schema.TaggedRequest<InternalCreateMachine>()(
  'InternalCreateMachine',
  {
    failure: MachineAssetCreateError,
    success: MachineAsset,
    payload: {
      params: CreateMachineParams,
    },
  }
) {}

export class InternalGetMachine extends Schema.TaggedRequest<InternalGetMachine>()(
  'InternalGetMachine',
  {
    failure: MachineMachineAssetNotFoundError,
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalUpdateMachine extends Schema.TaggedRequest<InternalUpdateMachine>()(
  'InternalUpdateMachine',
  {
    failure: MachineMachineAssetNotFoundError,
    success: MachineAsset,
    payload: {
      machine: MachineAsset,
    },
  }
) {}

export class InternalActivate extends Schema.TaggedRequest<InternalActivate>()(
  'InternalActivate',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalGoIdle extends Schema.TaggedRequest<InternalGoIdle>()(
  'InternalGoIdle',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalResume extends Schema.TaggedRequest<InternalResume>()(
  'InternalResume',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalMarkFaulted extends Schema.TaggedRequest<InternalMarkFaulted>()(
  'InternalMarkFaulted',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalScheduleRepair extends Schema.TaggedRequest<InternalScheduleRepair>()(
  'InternalScheduleRepair',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalEmergencyRepair extends Schema.TaggedRequest<InternalEmergencyRepair>()(
  'InternalEmergencyRepair',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalScheduleMaintenance extends Schema.TaggedRequest<InternalScheduleMaintenance>()(
  'InternalScheduleMaintenance',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalCompleteMaintenance extends Schema.TaggedRequest<InternalCompleteMaintenance>()(
  'InternalCompleteMaintenance',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalRetire extends Schema.TaggedRequest<InternalRetire>()(
  'InternalRetire',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

export class InternalDecommission extends Schema.TaggedRequest<InternalDecommission>()(
  'InternalDecommission',
  {
    failure: Schema.Union(MachineMachineAssetNotFoundError, MachineMachineAssetInvalidTransitionError),
    success: MachineAsset,
    payload: {
      machineId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface MachineAssetMachineState {
  readonly mode: MachineAssetStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface MachineAssetMachineDeps {
  readonly state: MachineStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

export const makeMachineAssetMachine = (deps: MachineAssetMachineDeps) =>
  Machine.make(
    (_input: void, previous?: MachineAssetMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        const initialState: MachineAssetMachineState = previous ?? { mode: 'commissioned' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateMachine>()(
            'InternalCreateMachine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineAssetCreateError({ message: `Create machine failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[MachineAssetMachine] Created machine ${entity.id}`)

                return [entity, { mode: 'commissioned' as MachineAssetStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetMachine>()(
            'InternalGetMachine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )

                return [entity, { mode: entity.status as MachineAssetStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateMachine>()(
            'InternalUpdateMachine',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.machine.id).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machine.id }))
                  )
                )

                yield* state.set(request.machine)
                yield* Effect.logInfo(`[MachineAssetMachine] Updated machine ${request.machine.id}`)

                return [request.machine, { mode: request.machine.status as MachineAssetStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // ACTIVATE (commissioned -> operational)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalActivate>()(
            'InternalActivate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'operational'
                if (!canActivate(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot activate machine in state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} activated`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GO IDLE (operational -> idle)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGoIdle>()(
            'InternalGoIdle',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'idle'
                if (!canGoIdle(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot go idle from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} went idle`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RESUME (idle -> operational)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalResume>()(
            'InternalResume',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'operational'
                if (!canResume(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot resume from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} resumed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK FAULTED (operational|idle -> faulted)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMarkFaulted>()(
            'InternalMarkFaulted',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'faulted'
                if (!canMarkFaulted(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot mark faulted from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} marked faulted`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SCHEDULE REPAIR (faulted -> scheduled_maintenance)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalScheduleRepair>()(
            'InternalScheduleRepair',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'scheduled_maintenance'
                if (!canScheduleRepair(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot schedule repair from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} scheduled for repair`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // EMERGENCY REPAIR (faulted -> unscheduled_maintenance)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalEmergencyRepair>()(
            'InternalEmergencyRepair',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'unscheduled_maintenance'
                if (!canEmergencyRepair(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot perform emergency repair from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} emergency repair started`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SCHEDULE MAINTENANCE (operational|idle -> scheduled_maintenance)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalScheduleMaintenance>()(
            'InternalScheduleMaintenance',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'scheduled_maintenance'
                if (!canScheduleMaintenance(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot schedule maintenance from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} scheduled for maintenance`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE MAINTENANCE (scheduled_maintenance|unscheduled_maintenance -> operational)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteMaintenance>()(
            'InternalCompleteMaintenance',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'operational'
                if (!canCompleteMaintenance(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot complete maintenance from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} maintenance completed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RETIRE (operational|idle -> retired)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalRetire>()(
            'InternalRetire',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'retired'
                if (!canRetire(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot retire from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} retired`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (retired|scheduled_maintenance -> decommissioned)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommission>()(
            'InternalDecommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.machineId as MachineId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineMachineAssetNotFoundError({ entityId: request.machineId }))
                  )
                )
                const currentState = entity.status as MachineAssetStateNode
                const targetState: MachineAssetStateNode = 'decommissioned'
                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(new MachineMachineAssetInvalidTransitionError({
                    entityId: request.machineId, fromState: currentState, toState: targetState,
                    message: `Cannot decommission from state '${currentState}'.`,
                  }))
                }
                const updated = new MachineAsset({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[MachineAssetMachine] Machine ${request.machineId} decommissioned`)
                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the MachineAssetMachine */
export type MachineAssetMachine = ReturnType<typeof makeMachineAssetMachine>

/** Type of the booted MachineAssetMachine actor */
export type MachineAssetMachineActor = Awaited<ReturnType<typeof Machine.boot<MachineAssetMachine>>>
