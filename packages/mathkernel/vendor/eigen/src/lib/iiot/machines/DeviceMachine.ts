/**
 * DeviceMachine - Effect Machine for Device Lifecycle
 *
 * Internal actor-style state machine that wraps DeviceState service.
 * Used by DeviceEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 compliant)
 * - Feature-flag controlled event emission
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * DeviceEntity.toLayer()
 *   └──▶ Machine.boot(DeviceMachine)
 *         └──▶ actor.send(InternalCreateDevice)
 *               └──▶ Machine.procedures.add() handler
 *                     └──▶ state.create/get/set (StateService)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { DeviceStateShape } from '../state/DeviceState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Device, CreateDeviceParams } from '../schemas/assets/device'
import type { DeviceId } from '../schemas/identifiers'
import {
  canGoOnline,
  canGoOffline,
  canMarkFaulted,
  canClearFault,
  canStartFirmwareUpdate,
  canCompleteFirmwareUpdate,
  canFailFirmwareUpdate,
  canDecommission,
  type DeviceStateNode,
} from './graphs/device-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Device not found in state service */
export class MachineDeviceNotFoundError extends Schema.TaggedError<MachineDeviceNotFoundError>()(
  'MachineDeviceNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per device graph */
export class MachineDeviceInvalidTransitionError extends Schema.TaggedError<MachineDeviceInvalidTransitionError>()(
  'MachineDeviceInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class DeviceCreateError extends Schema.TaggedError<DeviceCreateError>()(
  'DeviceCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateDevice extends Schema.TaggedRequest<InternalCreateDevice>()(
  'InternalCreateDevice',
  {
    failure: DeviceCreateError,
    success: Device,
    payload: {
      params: CreateDeviceParams,
    },
  }
) {}

export class InternalGetDevice extends Schema.TaggedRequest<InternalGetDevice>()(
  'InternalGetDevice',
  {
    failure: MachineDeviceNotFoundError,
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalUpdateDevice extends Schema.TaggedRequest<InternalUpdateDevice>()(
  'InternalUpdateDevice',
  {
    failure: MachineDeviceNotFoundError,
    success: Device,
    payload: {
      device: Device,
    },
  }
) {}

export class InternalGoOnline extends Schema.TaggedRequest<InternalGoOnline>()(
  'InternalGoOnline',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalGoOffline extends Schema.TaggedRequest<InternalGoOffline>()(
  'InternalGoOffline',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalDeviceMarkFaulted extends Schema.TaggedRequest<InternalDeviceMarkFaulted>()(
  'InternalDeviceMarkFaulted',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalDeviceClearFault extends Schema.TaggedRequest<InternalDeviceClearFault>()(
  'InternalDeviceClearFault',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalStartFirmwareUpdate extends Schema.TaggedRequest<InternalStartFirmwareUpdate>()(
  'InternalStartFirmwareUpdate',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalCompleteFirmwareUpdate extends Schema.TaggedRequest<InternalCompleteFirmwareUpdate>()(
  'InternalCompleteFirmwareUpdate',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalFailFirmwareUpdate extends Schema.TaggedRequest<InternalFailFirmwareUpdate>()(
  'InternalFailFirmwareUpdate',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

export class InternalDeviceDecommission extends Schema.TaggedRequest<InternalDeviceDecommission>()(
  'InternalDeviceDecommission',
  {
    failure: Schema.Union(MachineDeviceNotFoundError, MachineDeviceInvalidTransitionError),
    success: Device,
    payload: {
      deviceId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface DeviceMachineState {
  readonly mode: DeviceStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface DeviceMachineDeps {
  readonly state: DeviceStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

export const makeDeviceMachine = (deps: DeviceMachineDeps) =>
  Machine.make(
    (_input: void, previous?: DeviceMachineState) =>
      Effect.gen(function* () {
        const { state, flags: _flags } = deps

        const initialState: DeviceMachineState = previous ?? { mode: 'provisioned' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateDevice>()(
            'InternalCreateDevice',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new DeviceCreateError({ message: `Create device failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[DeviceMachine] Created device ${entity.id}`)

                return [entity, { mode: 'provisioned' as DeviceStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetDevice>()(
            'InternalGetDevice',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )

                return [entity, { mode: entity.status as DeviceStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // UPDATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalUpdateDevice>()(
            'InternalUpdateDevice',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                yield* state.get(request.device.id).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.device.id }))
                  )
                )

                yield* state.set(request.device)
                yield* Effect.logInfo(`[DeviceMachine] Updated device ${request.device.id}`)

                return [request.device, { mode: request.device.status as DeviceStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GO ONLINE (provisioned|offline -> online)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGoOnline>()(
            'InternalGoOnline',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'online'
                if (!canGoOnline(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot go online from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} went online`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GO OFFLINE (online -> offline)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGoOffline>()(
            'InternalGoOffline',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'offline'
                if (!canGoOffline(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot go offline from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} went offline`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // MARK FAULTED (online|offline -> faulted)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDeviceMarkFaulted>()(
            'InternalDeviceMarkFaulted',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'faulted'
                if (!canMarkFaulted(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot mark faulted from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} marked faulted`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLEAR FAULT (faulted -> offline)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDeviceClearFault>()(
            'InternalDeviceClearFault',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'offline'
                if (!canClearFault(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot clear fault from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} fault cleared`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // START FIRMWARE UPDATE (online|offline -> firmware_update)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalStartFirmwareUpdate>()(
            'InternalStartFirmwareUpdate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'firmware_update'
                if (!canStartFirmwareUpdate(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot start firmware update from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} firmware update started`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMPLETE FIRMWARE UPDATE (firmware_update -> online)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCompleteFirmwareUpdate>()(
            'InternalCompleteFirmwareUpdate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'online'
                if (!canCompleteFirmwareUpdate(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot complete firmware update from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} firmware update completed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // FAIL FIRMWARE UPDATE (firmware_update -> offline)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalFailFirmwareUpdate>()(
            'InternalFailFirmwareUpdate',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'offline'
                if (!canFailFirmwareUpdate(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot fail firmware update from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} firmware update failed`)
                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (offline|faulted -> decommissioned)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDeviceDecommission>()(
            'InternalDeviceDecommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const entity = yield* state.get(request.deviceId as DeviceId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineDeviceNotFoundError({ entityId: request.deviceId }))
                  )
                )
                const currentState = entity.status as DeviceStateNode
                const targetState: DeviceStateNode = 'decommissioned'
                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(new MachineDeviceInvalidTransitionError({
                    entityId: request.deviceId, fromState: currentState, toState: targetState,
                    message: `Cannot decommission from state '${currentState}'.`,
                  }))
                }
                const updated = new Device({ ...entity, status: targetState })
                yield* state.set(updated)
                yield* Effect.logInfo(`[DeviceMachine] Device ${request.deviceId} decommissioned`)
                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the DeviceMachine */
export type DeviceMachine = ReturnType<typeof makeDeviceMachine>

/** Type of the booted DeviceMachine actor */
export type DeviceMachineActor = Awaited<ReturnType<typeof Machine.boot<DeviceMachine>>>
