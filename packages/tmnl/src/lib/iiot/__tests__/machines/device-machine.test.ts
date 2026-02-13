/**
 * DeviceMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 device lifecycle state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'
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
} from '../../machines/DeviceMachine'
import { DeviceStateInMemory, DeviceState } from '../../state/DeviceState'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateDeviceParams } from '../../schemas/assets/device'
import type { MachineId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestDeviceParams = (overrides?: Partial<{
  slug: string
  name: string
  deviceType: string
}>): CreateDeviceParams => ({
  slug: (overrides?.slug ?? 'test-device-001') as CreateDeviceParams['slug'],
  name: (overrides?.name ?? 'Test Device') as CreateDeviceParams['name'],
  machineId: 'MCH-test-machine' as MachineId,
  deviceType: (overrides?.deviceType ?? 'motor') as CreateDeviceParams['deviceType'],
  status: 'provisioned',
})

// =============================================================================
// Tests
// =============================================================================

describe('DeviceMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a device and returns it with initial state', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )

        expect(result.name).toBe('Test Device')
        expect(result.deviceType).toBe('motor')
        expect(result.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created device', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetDevice({ deviceId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineDeviceNotFoundError for non-existent device', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetDevice({ deviceId: 'DEV-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineDeviceNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GO ONLINE procedure (provisioned|offline -> online)', () => {
    it.effect('brings a provisioned device online', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )

        const online = yield* actor.send(
          new InternalGoOnline({ deviceId: created.id })
        )

        expect(online.status).toBe('online')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GO OFFLINE procedure (online -> offline)', () => {
    it.effect('takes an online device offline', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const offline = yield* actor.send(
          new InternalGoOffline({ deviceId: created.id })
        )

        expect(offline.status).toBe('offline')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MARK FAULTED procedure (online|offline -> faulted)', () => {
    it.effect('marks an online device as faulted', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const faulted = yield* actor.send(
          new InternalDeviceMarkFaulted({ deviceId: created.id })
        )

        expect(faulted.status).toBe('faulted')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLEAR FAULT procedure (faulted -> offline)', () => {
    it.effect('clears a fault and returns to offline', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalDeviceMarkFaulted({ deviceId: created.id }))

        const cleared = yield* actor.send(
          new InternalDeviceClearFault({ deviceId: created.id })
        )

        expect(cleared.status).toBe('offline')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('START FIRMWARE UPDATE procedure (online|offline -> firmware_update)', () => {
    it.effect('starts firmware update from online state', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const updating = yield* actor.send(
          new InternalStartFirmwareUpdate({ deviceId: created.id })
        )

        expect(updating.status).toBe('firmware_update')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE FIRMWARE UPDATE procedure (firmware_update -> online)', () => {
    it.effect('completes firmware update and goes online', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalStartFirmwareUpdate({ deviceId: created.id }))

        const completed = yield* actor.send(
          new InternalCompleteFirmwareUpdate({ deviceId: created.id })
        )

        expect(completed.status).toBe('online')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FAIL FIRMWARE UPDATE procedure (firmware_update -> offline)', () => {
    it.effect('fails firmware update and goes offline', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalStartFirmwareUpdate({ deviceId: created.id }))

        const failed = yield* actor.send(
          new InternalFailFirmwareUpdate({ deviceId: created.id })
        )

        expect(failed.status).toBe('offline')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (offline|faulted -> decommissioned)', () => {
    it.effect('decommissions an offline device', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalGoOffline({ deviceId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalDeviceDecommission({ deviceId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when trying to transition from decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalGoOffline({ deviceId: created.id }))
        yield* actor.send(new InternalDeviceDecommission({ deviceId: created.id }))

        // Cannot go online from decommissioned
        const result = yield* actor.send(
          new InternalGoOnline({ deviceId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineDeviceInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when trying to go offline from provisioned (no direct)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )

        // Cannot go offline from provisioned
        const result = yield* actor.send(
          new InternalGoOffline({ deviceId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineDeviceInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: provisioned -> online -> firmware_update -> online -> offline -> faulted -> offline -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create (provisioned)
        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        expect(created.status).toBe('provisioned')

        // Go online
        const online1 = yield* actor.send(
          new InternalGoOnline({ deviceId: created.id })
        )
        expect(online1.status).toBe('online')

        // Start firmware update
        const updating = yield* actor.send(
          new InternalStartFirmwareUpdate({ deviceId: created.id })
        )
        expect(updating.status).toBe('firmware_update')

        // Complete firmware update
        const online2 = yield* actor.send(
          new InternalCompleteFirmwareUpdate({ deviceId: created.id })
        )
        expect(online2.status).toBe('online')

        // Go offline
        const offline1 = yield* actor.send(
          new InternalGoOffline({ deviceId: created.id })
        )
        expect(offline1.status).toBe('offline')

        // Mark faulted
        const faulted = yield* actor.send(
          new InternalDeviceMarkFaulted({ deviceId: created.id })
        )
        expect(faulted.status).toBe('faulted')

        // Clear fault (goes to offline)
        const offline2 = yield* actor.send(
          new InternalDeviceClearFault({ deviceId: created.id })
        )
        expect(offline2.status).toBe('offline')

        // Decommission
        const decommissioned = yield* actor.send(
          new InternalDeviceDecommission({ deviceId: created.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetDevice({ deviceId: created.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
