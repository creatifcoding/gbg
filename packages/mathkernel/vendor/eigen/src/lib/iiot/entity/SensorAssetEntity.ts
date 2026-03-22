/**
 * SensorAssetEntity - Effect Cluster Entity for Sensor Asset Lifecycle
 *
 * Manages ISA-95 compliant sensor asset lifecycle with state machine transitions.
 * NOTE: This is for Sensor ASSET management, distinct from SensorEntity which
 * handles sensor readings and real-time aggregation.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: Sensor state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize sensor with entity-scoped state
 * - Get: Read current sensor state
 * - StartCalibration: Active|Needs Calibration -> Calibrating (graph-validated)
 * - CompleteCalibration: Calibrating -> Active (graph-validated)
 * - FailCalibration: Calibrating -> Faulted (graph-validated)
 * - FlagForCalibration: Active -> Needs Calibration (graph-validated)
 * - MarkFaulted: Active -> Faulted (graph-validated)
 * - ClearFault: Faulted -> Active (graph-validated)
 * - TakeOffline: Faulted|Active -> Offline (graph-validated)
 * - BringOnline: Offline -> Active (graph-validated)
 * - Decommission: Offline|Faulted -> Decommissioned (graph-validated)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Sensor, CreateSensorParams, type SensorId } from '../schemas/assets/sensor'
import { SensorAssetState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeSensorAssetMachine,
  InternalCreateSensor,
  InternalGetSensor,
  InternalStartCalibration,
  InternalCompleteCalibration,
  InternalFailCalibration,
  InternalFlagForCalibration,
  InternalSensorMarkFaulted,
  InternalSensorClearFault,
  InternalTakeOffline,
  InternalBringOnline,
  InternalSensorDecommission,
} from '../machines/SensorAssetMachine'

// =============================================================================
// Import SensorId schema for RPC payloads
// =============================================================================

// Use the SensorId from the sensor schema (pattern-validated SNS- prefix)
const SensorIdSchema = Sensor.fields.id

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Sensor asset not found error */
export class RpcSensorAssetNotFoundError extends Schema.TaggedError<RpcSensorAssetNotFoundError>()(
  'RpcSensorAssetNotFoundError',
  {
    sensorId: Schema.String,
  }
) {}

/** Sensor asset transition error (invalid state transition) */
export class RpcSensorAssetTransitionError extends Schema.TaggedError<RpcSensorAssetTransitionError>()(
  'RpcSensorAssetTransitionError',
  {
    sensorId: Schema.String,
    message: Schema.String,
  }
) {}

/** Sensor asset query error */
export class RpcSensorAssetQueryError extends Schema.TaggedError<RpcSensorAssetQueryError>()(
  'RpcSensorAssetQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const SensorAssetEntityType = 'SensorAsset' as const
export const SensorAssetCreateTag = `${SensorAssetEntityType}.Create` as const
export const SensorAssetGetTag = `${SensorAssetEntityType}.Get` as const
export const SensorAssetStartCalibrationTag = `${SensorAssetEntityType}.StartCalibration` as const
export const SensorAssetCompleteCalibrationTag = `${SensorAssetEntityType}.CompleteCalibration` as const
export const SensorAssetFailCalibrationTag = `${SensorAssetEntityType}.FailCalibration` as const
export const SensorAssetFlagForCalibrationTag = `${SensorAssetEntityType}.FlagForCalibration` as const
export const SensorAssetMarkFaultedTag = `${SensorAssetEntityType}.MarkFaulted` as const
export const SensorAssetClearFaultTag = `${SensorAssetEntityType}.ClearFault` as const
export const SensorAssetTakeOfflineTag = `${SensorAssetEntityType}.TakeOffline` as const
export const SensorAssetBringOnlineTag = `${SensorAssetEntityType}.BringOnline` as const
export const SensorAssetDecommissionTag = `${SensorAssetEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

export class CreateSensorAssetRpc extends Rpc.make(SensorAssetCreateTag, {
  payload: CreateSensorParams,
  primaryKey: ({ slug }) => slug,
  success: Sensor,
  error: RpcSensorAssetQueryError,
}) {}

export class GetSensorAssetRpc extends Rpc.make(SensorAssetGetTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: RpcSensorAssetNotFoundError,
}) {}

export class StartCalibrationSensorAssetRpc extends Rpc.make(SensorAssetStartCalibrationTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class CompleteCalibrationSensorAssetRpc extends Rpc.make(SensorAssetCompleteCalibrationTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class FailCalibrationSensorAssetRpc extends Rpc.make(SensorAssetFailCalibrationTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class FlagForCalibrationSensorAssetRpc extends Rpc.make(SensorAssetFlagForCalibrationTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class MarkFaultedSensorAssetRpc extends Rpc.make(SensorAssetMarkFaultedTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class ClearFaultSensorAssetRpc extends Rpc.make(SensorAssetClearFaultTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class TakeOfflineSensorAssetRpc extends Rpc.make(SensorAssetTakeOfflineTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class BringOnlineSensorAssetRpc extends Rpc.make(SensorAssetBringOnlineTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

export class DecommissionSensorAssetRpc extends Rpc.make(SensorAssetDecommissionTag, {
  payload: Schema.Struct({ sensorId: SensorIdSchema }),
  primaryKey: ({ sensorId }) => sensorId,
  success: Sensor,
  error: Schema.Union(RpcSensorAssetNotFoundError, RpcSensorAssetTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const SensorAssetEntity = Entity.make(SensorAssetEntityType, [
  CreateSensorAssetRpc,
  GetSensorAssetRpc,
  StartCalibrationSensorAssetRpc,
  CompleteCalibrationSensorAssetRpc,
  FailCalibrationSensorAssetRpc,
  FlagForCalibrationSensorAssetRpc,
  MarkFaultedSensorAssetRpc,
  ClearFaultSensorAssetRpc,
  TakeOfflineSensorAssetRpc,
  BringOnlineSensorAssetRpc,
  DecommissionSensorAssetRpc,
])

export type SensorAssetEntity = typeof SensorAssetEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

export const SensorAssetEntityHandlers = SensorAssetEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* SensorAssetState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const sensorMachine = makeSensorAssetMachine({ state, flags })
    const actor = yield* Machine.boot(sensorMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreateSensorParams.Type }) =>
      actor.send(new InternalCreateSensor({ params: envelope.payload })).pipe(
        Effect.catchTag('SensorAssetCreateError', (e) =>
          Effect.fail(new RpcSensorAssetQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalGetSensor({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTag('MachineSensorNotFoundError', (e) =>
          Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleStartCalibration = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalStartCalibration({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`StartCalibration: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleCompleteCalibration = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalCompleteCalibration({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteCalibration: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleFailCalibration = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalFailCalibration({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`FailCalibration: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleFlagForCalibration = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalFlagForCalibration({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`FlagForCalibration: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleMarkFaulted = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalSensorMarkFaulted({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkFaulted: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleClearFault = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalSensorClearFault({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearFault: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleTakeOffline = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalTakeOffline({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`TakeOffline: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleBringOnline = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalBringOnline({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`BringOnline: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { sensorId: SensorId } }) =>
      actor.send(new InternalSensorDecommission({ sensorId: envelope.payload.sensorId })).pipe(
        Effect.catchTags({
          MachineSensorNotFoundError: (e) =>
            Effect.fail(new RpcSensorAssetNotFoundError({ sensorId: e.entityId })),
          MachineSensorInvalidTransitionError: (e) =>
            Effect.fail(new RpcSensorAssetTransitionError({ sensorId: e.entityId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for sensor ${envelope.payload.sensorId}`)
        )
      )

    return SensorAssetEntity.of({
      [SensorAssetCreateTag]: handleCreate,
      [SensorAssetGetTag]: handleGet,
      [SensorAssetStartCalibrationTag]: handleStartCalibration,
      [SensorAssetCompleteCalibrationTag]: handleCompleteCalibration,
      [SensorAssetFailCalibrationTag]: handleFailCalibration,
      [SensorAssetFlagForCalibrationTag]: handleFlagForCalibration,
      [SensorAssetMarkFaultedTag]: handleMarkFaulted,
      [SensorAssetClearFaultTag]: handleClearFault,
      [SensorAssetTakeOfflineTag]: handleTakeOffline,
      [SensorAssetBringOnlineTag]: handleBringOnline,
      [SensorAssetDecommissionTag]: handleDecommission,
    })
  })
)
