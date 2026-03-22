/**
 * SensorAssetMachine - Effect Machine for Sensor Asset Lifecycle
 *
 * Internal actor-style state machine that wraps SensorAssetState service.
 * Used by SensorAssetEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * SensorAssetEntity.toLayer()
 *   └──▶ Machine.boot(SensorAssetMachine)
 *         └──▶ actor.send(InternalCreateSensor)
 *               └──▶ Machine.procedures.add() handler
 *                     └──▶ state.create/get/set (StateService)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { SensorAssetStateShape } from '../state/SensorAssetState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Sensor, CreateSensorParams, type SensorId } from '../schemas/assets/sensor'
import {
  canStartCalibration,
  canCompleteCalibration,
  canFailCalibration,
  canFlagForCalibration,
  canMarkFaulted,
  canClearFault,
  canTakeOffline,
  canBringOnline,
  canDecommission,
  type SensorStateNode,
} from './graphs/sensor-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Sensor asset not found in state service */
export class MachineSensorNotFoundError extends Schema.TaggedError<MachineSensorNotFoundError>()(
  'MachineSensorNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per sensor graph */
export class MachineSensorInvalidTransitionError extends Schema.TaggedError<MachineSensorInvalidTransitionError>()(
  'MachineSensorInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class SensorAssetCreateError extends Schema.TaggedError<SensorAssetCreateError>()(
  'SensorAssetCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateSensor extends Schema.TaggedRequest<InternalCreateSensor>()(
  'InternalCreateSensor',
  {
    failure: SensorAssetCreateError,
    success: Sensor,
    payload: {
      params: CreateSensorParams,
    },
  }
) {}

export class InternalGetSensor extends Schema.TaggedRequest<InternalGetSensor>()(
  'InternalGetSensor',
  {
    failure: MachineSensorNotFoundError,
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalUpdateSensor extends Schema.TaggedRequest<InternalUpdateSensor>()(
  'InternalUpdateSensor',
  {
    failure: MachineSensorNotFoundError,
    success: Sensor,
    payload: {
      sensor: Sensor,
    },
  }
) {}

export class InternalStartCalibration extends Schema.TaggedRequest<InternalStartCalibration>()(
  'InternalStartCalibration',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalCompleteCalibration extends Schema.TaggedRequest<InternalCompleteCalibration>()(
  'InternalCompleteCalibration',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalFailCalibration extends Schema.TaggedRequest<InternalFailCalibration>()(
  'InternalFailCalibration',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalFlagForCalibration extends Schema.TaggedRequest<InternalFlagForCalibration>()(
  'InternalFlagForCalibration',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalSensorMarkFaulted extends Schema.TaggedRequest<InternalSensorMarkFaulted>()(
  'InternalSensorMarkFaulted',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalSensorClearFault extends Schema.TaggedRequest<InternalSensorClearFault>()(
  'InternalSensorClearFault',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalTakeOffline extends Schema.TaggedRequest<InternalTakeOffline>()(
  'InternalTakeOffline',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalBringOnline extends Schema.TaggedRequest<InternalBringOnline>()(
  'InternalBringOnline',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

export class InternalSensorDecommission extends Schema.TaggedRequest<InternalSensorDecommission>()(
  'InternalSensorDecommission',
  {
    failure: Schema.Union(MachineSensorNotFoundError, MachineSensorInvalidTransitionError),
    success: Sensor,
    payload: {
      sensorId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface SensorAssetMachineState {
  readonly mode: SensorStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface SensorAssetMachineDeps {
  readonly state: SensorAssetStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

export const makeSensorAssetMachine = (deps: SensorAssetMachineDeps) =>
  Machine.make(
    (_input: void, previous?: SensorAssetMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        const initialState: SensorAssetMachineState = previous ?? { mode: 'active' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateSensor>()(
            'InternalCreateSensor',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new SensorAssetCreateError({ message: `Create sensor failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[SensorAssetMachine] Created sensor ${entity.id}`)

                return [entity, { mode: 'active' as SensorStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetSensor>()(
            'InternalGetSensor',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )

                return [entity, { mode: entity.status as SensorStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateSensor>()(
            'InternalUpdateSensor',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.sensor.id).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensor.id }))
                  )
                )

                yield* state.set(request.sensor)
                yield* Effect.logInfo(`[SensorAssetMachine] Updated sensor ${request.sensor.id}`)

                return [request.sensor, { mode: request.sensor.status as SensorStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // START CALIBRATION (active|needs_calibration -> calibrating)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStartCalibration>()(
            'InternalStartCalibration',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'calibrating'
                if (!canStartCalibration(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot start calibration from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} calibration started`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE CALIBRATION (calibrating -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteCalibration>()(
            'InternalCompleteCalibration',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'active'
                if (!canCompleteCalibration(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot complete calibration from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} calibration completed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // FAIL CALIBRATION (calibrating -> faulted)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalFailCalibration>()(
            'InternalFailCalibration',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'faulted'
                if (!canFailCalibration(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot fail calibration from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} calibration failed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // FLAG FOR CALIBRATION (active -> needs_calibration)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalFlagForCalibration>()(
            'InternalFlagForCalibration',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'needs_calibration'
                if (!canFlagForCalibration(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot flag for calibration from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} flagged for calibration`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK FAULTED (active -> faulted)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSensorMarkFaulted>()(
            'InternalSensorMarkFaulted',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'faulted'
                if (!canMarkFaulted(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot mark faulted from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} marked faulted`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR FAULT (faulted -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSensorClearFault>()(
            'InternalSensorClearFault',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'active'
                if (!canClearFault(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot clear fault from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} fault cleared`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // TAKE OFFLINE (faulted|active -> offline)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalTakeOffline>()(
            'InternalTakeOffline',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'offline'
                if (!canTakeOffline(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot take offline from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} taken offline`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // BRING ONLINE (offline -> active)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalBringOnline>()(
            'InternalBringOnline',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'active'
                if (!canBringOnline(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot bring online from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} brought online`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (offline|faulted -> decommissioned)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSensorDecommission>()(
            'InternalSensorDecommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.sensorId as SensorId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineSensorNotFoundError({ entityId: request.sensorId }))
                  )
                )
                const currentState = entity.status as SensorStateNode
                const targetState: SensorStateNode = 'decommissioned'
                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(new MachineSensorInvalidTransitionError({
                    entityId: request.sensorId, fromState: currentState, toState: targetState,
                    message: `Cannot decommission from state '${currentState}'.`,
                  }))
                }
                const updated = new Sensor({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[SensorAssetMachine] Sensor ${request.sensorId} decommissioned`)
                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the SensorAssetMachine */
export type SensorAssetMachine = ReturnType<typeof makeSensorAssetMachine>

/** Type of the booted SensorAssetMachine actor */
export type SensorAssetMachineActor = Awaited<ReturnType<typeof Machine.boot<SensorAssetMachine>>>
