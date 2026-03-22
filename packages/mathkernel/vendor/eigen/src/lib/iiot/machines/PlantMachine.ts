/**
 * PlantMachine - Effect Machine for Plant Lifecycle
 *
 * Internal actor-style state machine that wraps PlantState service.
 * Used by PlantEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * PlantEntity.toLayer()
 *   |-> Machine.boot(PlantMachine)
 *         |-> actor.send(InternalCreatePlant)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> event emission (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { PlantStateShape } from '../state/PlantState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Plant, CreatePlantParams } from '../schemas/assets/plant'
import type { PlantId } from '../schemas/identifiers'
import {
  canCompleteCommissioning,
  canScheduledShutdown,
  canRestart,
  canEmergencyShutdown,
  canBeginEmergencyMaintenance,
  canCompleteMaintenanceRestart,
  canMaintenanceShutdown,
  canDecommission,
  type PlantStateNode,
} from './graphs/plant-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Plant not found in state service */
export class MachinePlantNotFoundError extends Schema.TaggedError<MachinePlantNotFoundError>()(
  'MachinePlantNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per ISA-95 plant graph */
export class MachinePlantInvalidTransitionError extends Schema.TaggedError<MachinePlantInvalidTransitionError>()(
  'MachinePlantInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachinePlantCreateError extends Schema.TaggedError<MachinePlantCreateError>()(
  'MachinePlantCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

/**
 * Internal request to create a plant.
 * Not exposed as RPC -- used for Machine procedure delegation.
 */
export class InternalCreatePlant extends Schema.TaggedRequest<InternalCreatePlant>()(
  'InternalCreatePlant',
  {
    failure: MachinePlantCreateError,
    success: Plant,
    payload: {
      params: CreatePlantParams,
    },
  }
) {}

/**
 * Internal request to get a plant by ID.
 */
export class InternalGetPlant extends Schema.TaggedRequest<InternalGetPlant>()(
  'InternalGetPlant',
  {
    failure: MachinePlantNotFoundError,
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

/**
 * Internal request to update a plant.
 */
export class InternalUpdatePlant extends Schema.TaggedRequest<InternalUpdatePlant>()(
  'InternalUpdatePlant',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantCreateError),
    success: Plant,
    payload: {
      plant: Plant,
    },
  }
) {}

// =============================================================================
// Transition Requests
// =============================================================================

export class InternalCompleteCommissioning extends Schema.TaggedRequest<InternalCompleteCommissioning>()(
  'InternalCompleteCommissioning',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalScheduledShutdown extends Schema.TaggedRequest<InternalScheduledShutdown>()(
  'InternalScheduledShutdown',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalRestart extends Schema.TaggedRequest<InternalRestart>()(
  'InternalRestart',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalEmergencyShutdown extends Schema.TaggedRequest<InternalEmergencyShutdown>()(
  'InternalEmergencyShutdown',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalBeginEmergencyMaintenance extends Schema.TaggedRequest<InternalBeginEmergencyMaintenance>()(
  'InternalBeginEmergencyMaintenance',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalMaintenanceShutdown extends Schema.TaggedRequest<InternalMaintenanceShutdown>()(
  'InternalMaintenanceShutdown',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalCompleteMaintenanceRestart extends Schema.TaggedRequest<InternalCompleteMaintenanceRestart>()(
  'InternalCompleteMaintenanceRestart',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

export class InternalDecommissionPlant extends Schema.TaggedRequest<InternalDecommissionPlant>()(
  'InternalDecommissionPlant',
  {
    failure: Schema.Union(MachinePlantNotFoundError, MachinePlantInvalidTransitionError),
    success: Plant,
    payload: {
      plantId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

/**
 * Internal machine state tracking current plant mode.
 * This is separate from the persisted Plant state -- it tracks
 * the Machine's procedure context.
 */
export interface PlantMachineState {
  /** Current operational mode (tracks last known plant state) */
  readonly mode: PlantStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

/**
 * Dependencies required to construct the PlantMachine.
 * Injected via Entity.toLayer() Effect.gen.
 */
export interface PlantMachineDeps {
  /** State service port for plant persistence */
  readonly state: PlantStateShape
  /** Feature flags for event emission control */
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a PlantMachine with injected dependencies.
 *
 * The machine wraps the PlantState service and validates
 * all state transitions via the ISA-95 plant state graph.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makePlantMachine = (deps: PlantMachineDeps) =>
  Machine.make(
    (_input: void, previous?: PlantMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        // Initial machine state (commissioning is the starting state for new plants)
        const initialState: PlantMachineState = previous ?? { mode: 'commissioning' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreatePlant>()(
            'InternalCreatePlant',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachinePlantCreateError({ message: `Create plant failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[PlantMachine] Created plant ${plant.id}`)
                yield* Effect.logInfo(`[ES:Plant] PlantCreated`, { payload: { plant } }).pipe(
                  Effect.catchAll((err) => Effect.logWarning(`Event emission failed: ${String(err)}`))
                )

                return [plant, { mode: 'commissioning' as PlantStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetPlant>()(
            'InternalGetPlant',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                return [plant, { mode: plant.status as PlantStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdatePlant>()(
            'InternalUpdatePlant',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.plant.id as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plant.id }))
                  )
                )

                yield* state.set(request.plant).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachinePlantCreateError({ message: `Update plant failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[PlantMachine] Updated plant ${request.plant.id}`)

                return [request.plant, { mode: request.plant.status as PlantStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE COMMISSIONING (graph-validated)
          // commissioning -> operational
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteCommissioning>()(
            'InternalCompleteCommissioning',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'operational'

                if (!canCompleteCommissioning(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot complete commissioning in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} commissioned`)
                yield* Effect.logInfo(`[ES:Plant] PlantCommissioned`, { payload: { plant: updated } }).pipe(
                  Effect.catchAll((err) => Effect.logWarning(`Event emission failed: ${String(err)}`))
                )

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SCHEDULED SHUTDOWN (graph-validated)
          // operational -> scheduled_shutdown
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalScheduledShutdown>()(
            'InternalScheduledShutdown',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'scheduled_shutdown'

                if (!canScheduledShutdown(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot initiate scheduled shutdown in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} scheduled shutdown`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // RESTART (graph-validated)
          // scheduled_shutdown -> operational
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalRestart>()(
            'InternalRestart',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'operational'

                if (!canRestart(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot restart in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} restarted`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // EMERGENCY SHUTDOWN (graph-validated)
          // operational -> emergency_shutdown
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalEmergencyShutdown>()(
            'InternalEmergencyShutdown',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'emergency_shutdown'

                if (!canEmergencyShutdown(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot initiate emergency shutdown in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} emergency shutdown`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // BEGIN EMERGENCY MAINTENANCE (graph-validated)
          // emergency_shutdown -> maintenance_shutdown
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalBeginEmergencyMaintenance>()(
            'InternalBeginEmergencyMaintenance',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'maintenance_shutdown'

                if (!canBeginEmergencyMaintenance(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot begin emergency maintenance in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} begin emergency maintenance`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MAINTENANCE SHUTDOWN (graph-validated)
          // operational -> maintenance_shutdown
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalMaintenanceShutdown>()(
            'InternalMaintenanceShutdown',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'maintenance_shutdown'

                if (!canMaintenanceShutdown(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot initiate maintenance shutdown in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} maintenance shutdown`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE MAINTENANCE RESTART (graph-validated)
          // maintenance_shutdown -> operational
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteMaintenanceRestart>()(
            'InternalCompleteMaintenanceRestart',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'operational'

                if (!canCompleteMaintenanceRestart(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot complete maintenance restart in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} maintenance restart complete`)

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (graph-validated)
          // scheduled_shutdown | maintenance_shutdown -> decommissioned
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommissionPlant>()(
            'InternalDecommissionPlant',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const plant = yield* state.get(request.plantId as PlantId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachinePlantNotFoundError({ entityId: request.plantId }))
                  )
                )

                const currentState = plant.status as PlantStateNode
                const targetState: PlantStateNode = 'decommissioned'

                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(
                    new MachinePlantInvalidTransitionError({
                      entityId: request.plantId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot decommission in state '${currentState}'.`,
                    })
                  )
                }

                const updated = new Plant({ ...plant, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[PlantMachine] Plant ${request.plantId} decommissioned`)

                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the PlantMachine */
export type PlantMachine = ReturnType<typeof makePlantMachine>

/** Type of the booted PlantMachine actor */
export type PlantMachineActor = Awaited<ReturnType<typeof Machine.boot<PlantMachine>>>
