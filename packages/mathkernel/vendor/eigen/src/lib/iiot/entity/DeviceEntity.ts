/**
 * DeviceEntity - Effect Cluster Entity for Device Lifecycle
 *
 * Manages ISA-95 compliant device lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: Device state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize device with entity-scoped state
 * - Get: Read current device state
 * - GoOnline: Provisioned|Offline -> Online (graph-validated)
 * - GoOffline: Online -> Offline (graph-validated)
 * - MarkFaulted: Online|Offline -> Faulted (graph-validated)
 * - ClearFault: Faulted -> Offline (graph-validated)
 * - StartFirmwareUpdate: Online|Offline -> Firmware Update (graph-validated)
 * - CompleteFirmwareUpdate: Firmware Update -> Online (graph-validated)
 * - FailFirmwareUpdate: Firmware Update -> Offline (graph-validated)
 * - Decommission: Offline|Faulted -> Decommissioned (graph-validated)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Device, CreateDeviceParams } from '../schemas/assets/device'
import { DeviceId } from '../schemas/identifiers'
import { DeviceState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeDeviceMachine,
  InternalCreateDevice,
  InternalGetDevice,
  InternalGoOnline,
  InternalGoOffline,
  InternalDeviceMarkFaulted,
  InternalDeviceClearFault,
  InternalStartFirmwareUpdate,
  InternalCompleteFirmwareUpdate,
  InternalFailFirmwareUpdate,
  InternalDeviceDecommission,
} from '../machines/DeviceMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Device not found error */
export class RpcDeviceNotFoundError extends Schema.TaggedError<RpcDeviceNotFoundError>()(
  'RpcDeviceNotFoundError',
  {
    deviceId: DeviceId,
  }
) {}

/** Device transition error (invalid state transition) */
export class RpcDeviceTransitionError extends Schema.TaggedError<RpcDeviceTransitionError>()(
  'RpcDeviceTransitionError',
  {
    deviceId: DeviceId,
    message: Schema.String,
  }
) {}

/** Device query error */
export class RpcDeviceQueryError extends Schema.TaggedError<RpcDeviceQueryError>()(
  'RpcDeviceQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const DeviceEntityType = 'Device' as const
export const DeviceCreateTag = `${DeviceEntityType}.Create` as const
export const DeviceGetTag = `${DeviceEntityType}.Get` as const
export const DeviceGoOnlineTag = `${DeviceEntityType}.GoOnline` as const
export const DeviceGoOfflineTag = `${DeviceEntityType}.GoOffline` as const
export const DeviceMarkFaultedTag = `${DeviceEntityType}.MarkFaulted` as const
export const DeviceClearFaultTag = `${DeviceEntityType}.ClearFault` as const
export const DeviceStartFirmwareUpdateTag = `${DeviceEntityType}.StartFirmwareUpdate` as const
export const DeviceCompleteFirmwareUpdateTag = `${DeviceEntityType}.CompleteFirmwareUpdate` as const
export const DeviceFailFirmwareUpdateTag = `${DeviceEntityType}.FailFirmwareUpdate` as const
export const DeviceDecommissionTag = `${DeviceEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

export class CreateDeviceRpc extends Rpc.make(DeviceCreateTag, {
  payload: CreateDeviceParams,
  primaryKey: ({ slug }) => slug,
  success: Device,
  error: RpcDeviceQueryError,
}) {}

export class GetDeviceRpc extends Rpc.make(DeviceGetTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: RpcDeviceNotFoundError,
}) {}

export class GoOnlineDeviceRpc extends Rpc.make(DeviceGoOnlineTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class GoOfflineDeviceRpc extends Rpc.make(DeviceGoOfflineTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class MarkFaultedDeviceRpc extends Rpc.make(DeviceMarkFaultedTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class ClearFaultDeviceRpc extends Rpc.make(DeviceClearFaultTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class StartFirmwareUpdateDeviceRpc extends Rpc.make(DeviceStartFirmwareUpdateTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class CompleteFirmwareUpdateDeviceRpc extends Rpc.make(DeviceCompleteFirmwareUpdateTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class FailFirmwareUpdateDeviceRpc extends Rpc.make(DeviceFailFirmwareUpdateTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

export class DecommissionDeviceRpc extends Rpc.make(DeviceDecommissionTag, {
  payload: Schema.Struct({ deviceId: DeviceId }),
  primaryKey: ({ deviceId }) => deviceId,
  success: Device,
  error: Schema.Union(RpcDeviceNotFoundError, RpcDeviceTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const DeviceAssetEntity = Entity.make(DeviceEntityType, [
  CreateDeviceRpc,
  GetDeviceRpc,
  GoOnlineDeviceRpc,
  GoOfflineDeviceRpc,
  MarkFaultedDeviceRpc,
  ClearFaultDeviceRpc,
  StartFirmwareUpdateDeviceRpc,
  CompleteFirmwareUpdateDeviceRpc,
  FailFirmwareUpdateDeviceRpc,
  DecommissionDeviceRpc,
])

export type DeviceAssetEntity = typeof DeviceAssetEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

export const DeviceEntityHandlers = DeviceAssetEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* DeviceState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const deviceMachine = makeDeviceMachine({ state, flags })
    const actor = yield* Machine.boot(deviceMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreateDeviceParams.Type }) =>
      actor.send(new InternalCreateDevice({ params: envelope.payload })).pipe(
        Effect.catchTag('DeviceCreateError', (e) =>
          Effect.fail(new RpcDeviceQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalGetDevice({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTag('MachineDeviceNotFoundError', (e) =>
          Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleGoOnline = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalGoOnline({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`GoOnline: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleGoOffline = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalGoOffline({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`GoOffline: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleMarkFaulted = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalDeviceMarkFaulted({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkFaulted: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleClearFault = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalDeviceClearFault({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearFault: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleStartFirmwareUpdate = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalStartFirmwareUpdate({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`StartFirmwareUpdate: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleCompleteFirmwareUpdate = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalCompleteFirmwareUpdate({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteFirmwareUpdate: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleFailFirmwareUpdate = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalFailFirmwareUpdate({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`FailFirmwareUpdate: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { deviceId: DeviceId } }) =>
      actor.send(new InternalDeviceDecommission({ deviceId: envelope.payload.deviceId })).pipe(
        Effect.catchTags({
          MachineDeviceNotFoundError: (e) =>
            Effect.fail(new RpcDeviceNotFoundError({ deviceId: e.entityId as DeviceId })),
          MachineDeviceInvalidTransitionError: (e) =>
            Effect.fail(new RpcDeviceTransitionError({ deviceId: e.entityId as DeviceId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for device ${envelope.payload.deviceId}`)
        )
      )

    return DeviceAssetEntity.of({
      [DeviceCreateTag]: handleCreate,
      [DeviceGetTag]: handleGet,
      [DeviceGoOnlineTag]: handleGoOnline,
      [DeviceGoOfflineTag]: handleGoOffline,
      [DeviceMarkFaultedTag]: handleMarkFaulted,
      [DeviceClearFaultTag]: handleClearFault,
      [DeviceStartFirmwareUpdateTag]: handleStartFirmwareUpdate,
      [DeviceCompleteFirmwareUpdateTag]: handleCompleteFirmwareUpdate,
      [DeviceFailFirmwareUpdateTag]: handleFailFirmwareUpdate,
      [DeviceDecommissionTag]: handleDecommission,
    })
  })
)
