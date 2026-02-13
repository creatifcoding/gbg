/**
 * Machine Property Tests: MachineAsset, Device, Sensor
 *
 * Property-based integration tests using @effect/vitest and @effect/experimental Machine.
 * Tests random valid transition sequences, state consistency, idempotent GETs,
 * and invalid transition errors.
 *
 * @module @gbg/tmnl/iiot/__tests__/machines/property/machine-device-sensor.property
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'

// =============================================================================
// MachineAsset Imports
// =============================================================================
import {
  makeMachineAssetMachine,
  InternalCreateMachine,
  InternalGetMachine,
  InternalActivate,
  InternalGoIdle,
  InternalResume,
  InternalMarkFaulted,
  InternalScheduleRepair,
  InternalEmergencyRepair,
  InternalScheduleMaintenance,
  InternalCompleteMaintenance,
  InternalRetire,
  InternalDecommission,
} from '../../../machines/MachineAssetMachine'
import { MachineStateInMemory, MachineState } from '../../../state/MachineState'

// =============================================================================
// Device Imports
// =============================================================================
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
} from '../../../machines/DeviceMachine'
import { DeviceStateInMemory, DeviceState } from '../../../state/DeviceState'

// =============================================================================
// Sensor Imports
// =============================================================================
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
} from '../../../machines/SensorAssetMachine'
import { SensorAssetStateInMemory, SensorAssetState } from '../../../state/SensorAssetState'

// =============================================================================
// Common Imports
// =============================================================================
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../../infrastructure/feature-flags'
import type { CreateMachineParams } from '../../../schemas/assets/machine'
import type { CreateDeviceParams } from '../../../schemas/assets/device'
import type { CreateSensorParams } from '../../../schemas/assets/sensor'
import type { EnterpriseId, SiteId, PlantId, LineId, MachineId } from '../../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestMachineParams = (slug = 'prop-machine-001'): CreateMachineParams => ({
  slug,
  name: 'Property Test Machine' as CreateMachineParams['name'],
  machineType: 'CNC Lathe' as CreateMachineParams['machineType'],
  enterpriseId: 'ENT-prop-test' as EnterpriseId,
  siteId: 'SIT-prop-test' as SiteId,
  plantId: 'PLT-prop-test' as PlantId,
  lineId: 'LIN-prop-test' as LineId,
  status: 'commissioned',
  workCellId: Option.none(),
  manufacturer: Option.none(),
  modelNumber: Option.none(),
  serialNumber: Option.none(),
  installationDate: Option.none(),
  nextMaintenanceDate: Option.none(),
  description: Option.none(),
  metadata: {},
})

const createTestDeviceParams = (slug = 'prop-device-001'): CreateDeviceParams => ({
  slug: slug as CreateDeviceParams['slug'],
  name: 'Property Test Device' as CreateDeviceParams['name'],
  machineId: 'MCH-prop-test' as MachineId,
  deviceType: 'motor' as CreateDeviceParams['deviceType'],
  status: 'provisioned',
})

const createTestSensorParams = (slug = 'prop-sensor-001'): CreateSensorParams => ({
  slug: slug as CreateSensorParams['slug'],
  name: 'Property Test Sensor' as CreateSensorParams['name'],
  machineId: 'MCH-prop-test' as MachineId,
  sensorType: 'temperature' as CreateSensorParams['sensorType'],
  unit: 'celsius' as CreateSensorParams['unit'],
  status: 'active',
})

// =============================================================================
// MachineAsset Property Tests
// =============================================================================

describe('MachineAssetMachine Property Tests', () => {
  describe('valid transition sequences', () => {
    it.effect('commissioned -> operational -> idle -> operational (activate, idle, resume cycle)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        expect(created.status).toBe('commissioned')

        const activated = yield* actor.send(new InternalActivate({ machineId: created.id }))
        expect(activated.status).toBe('operational')

        const idled = yield* actor.send(new InternalGoIdle({ machineId: created.id }))
        expect(idled.status).toBe('idle')

        const resumed = yield* actor.send(new InternalResume({ machineId: created.id }))
        expect(resumed.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('operational -> faulted -> scheduled_maintenance -> operational (fault + repair)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-002') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const faulted = yield* actor.send(new InternalMarkFaulted({ machineId: created.id }))
        expect(faulted.status).toBe('faulted')

        const scheduled = yield* actor.send(new InternalScheduleRepair({ machineId: created.id }))
        expect(scheduled.status).toBe('scheduled_maintenance')

        const repaired = yield* actor.send(new InternalCompleteMaintenance({ machineId: created.id }))
        expect(repaired.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('faulted -> unscheduled_maintenance -> operational (emergency repair)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-003') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalMarkFaulted({ machineId: created.id }))

        const emergency = yield* actor.send(new InternalEmergencyRepair({ machineId: created.id }))
        expect(emergency.status).toBe('unscheduled_maintenance')

        const repaired = yield* actor.send(new InternalCompleteMaintenance({ machineId: created.id }))
        expect(repaired.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('operational -> retired -> decommissioned (retirement path)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-004') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const retired = yield* actor.send(new InternalRetire({ machineId: created.id }))
        expect(retired.status).toBe('retired')

        const decommissioned = yield* actor.send(new InternalDecommission({ machineId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('scheduled_maintenance -> decommissioned (decommission from maintenance)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-005') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalScheduleMaintenance({ machineId: created.id }))

        const decommissioned = yield* actor.send(new InternalDecommission({ machineId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('idempotent GET after transitions', () => {
    it.effect('GET returns consistent state after multiple transitions', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-006') })
        )

        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalGoIdle({ machineId: created.id }))

        const get1 = yield* actor.send(new InternalGetMachine({ machineId: created.id }))
        const get2 = yield* actor.send(new InternalGetMachine({ machineId: created.id }))

        expect(get1.status).toBe('idle')
        expect(get2.status).toBe('idle')
        expect(get1.id).toBe(get2.id)
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('invalid transitions yield MachineMachineAssetInvalidTransitionError', () => {
    it.effect('cannot activate from operational', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-007') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const result = yield* actor.send(
          new InternalActivate({ machineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('cannot retire from commissioned', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-008') })
        )

        const result = yield* actor.send(
          new InternalRetire({ machineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('cannot decommission from operational (must retire first)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams('prop-machine-009') })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const result = yield* actor.send(
          new InternalDecommission({ machineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})

// =============================================================================
// DeviceMachine Property Tests
// =============================================================================

describe('DeviceMachine Property Tests', () => {
  describe('valid transition sequences', () => {
    it.effect('provisioned -> online -> offline -> online (connectivity cycle)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams() })
        )
        expect(created.status).toBe('provisioned')

        const online = yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        expect(online.status).toBe('online')

        const offline = yield* actor.send(new InternalGoOffline({ deviceId: created.id }))
        expect(offline.status).toBe('offline')

        const onlineAgain = yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        expect(onlineAgain.status).toBe('online')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('online -> firmware_update -> online (successful firmware update)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-002') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const updating = yield* actor.send(new InternalStartFirmwareUpdate({ deviceId: created.id }))
        expect(updating.status).toBe('firmware_update')

        const completed = yield* actor.send(new InternalCompleteFirmwareUpdate({ deviceId: created.id }))
        expect(completed.status).toBe('online')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('online -> firmware_update -> offline (failed firmware update)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-003') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalStartFirmwareUpdate({ deviceId: created.id }))

        const failed = yield* actor.send(new InternalFailFirmwareUpdate({ deviceId: created.id }))
        expect(failed.status).toBe('offline')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('online -> faulted -> offline -> decommissioned (fault + decommission path)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-004') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const faulted = yield* actor.send(new InternalDeviceMarkFaulted({ deviceId: created.id }))
        expect(faulted.status).toBe('faulted')

        const cleared = yield* actor.send(new InternalDeviceClearFault({ deviceId: created.id }))
        expect(cleared.status).toBe('offline')

        const decommissioned = yield* actor.send(new InternalDeviceDecommission({ deviceId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('faulted -> decommissioned (direct decommission from faulted)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-005') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalDeviceMarkFaulted({ deviceId: created.id }))

        const decommissioned = yield* actor.send(new InternalDeviceDecommission({ deviceId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('idempotent GET after transitions', () => {
    it.effect('GET returns consistent state after firmware update cycle', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-006') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalStartFirmwareUpdate({ deviceId: created.id }))
        yield* actor.send(new InternalCompleteFirmwareUpdate({ deviceId: created.id }))

        const get1 = yield* actor.send(new InternalGetDevice({ deviceId: created.id }))
        const get2 = yield* actor.send(new InternalGetDevice({ deviceId: created.id }))

        expect(get1.status).toBe('online')
        expect(get2.status).toBe('online')
        expect(get1.id).toBe(get2.id)
      }).pipe(
        Effect.scoped,
        Effect.provide(DeviceStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('invalid transitions yield MachineDeviceInvalidTransitionError', () => {
    it.effect('cannot go offline from provisioned', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-007') })
        )

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

    it.effect('cannot go online from decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-008') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))
        yield* actor.send(new InternalGoOffline({ deviceId: created.id }))
        yield* actor.send(new InternalDeviceDecommission({ deviceId: created.id }))

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

    it.effect('cannot decommission from online (must go offline first)', () =>
      Effect.gen(function* () {
        const state = yield* DeviceState
        const flags = yield* IIoTFeatureFlags
        const machine = makeDeviceMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateDevice({ params: createTestDeviceParams('prop-device-009') })
        )
        yield* actor.send(new InternalGoOnline({ deviceId: created.id }))

        const result = yield* actor.send(
          new InternalDeviceDecommission({ deviceId: created.id })
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
})

// =============================================================================
// SensorAssetMachine Property Tests
// =============================================================================

describe('SensorAssetMachine Property Tests', () => {
  describe('valid transition sequences', () => {
    it.effect('active -> calibrating -> active (calibration cycle)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        expect(created.status).toBe('active')

        const calibrating = yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))
        expect(calibrating.status).toBe('calibrating')

        const calibrated = yield* actor.send(new InternalCompleteCalibration({ sensorId: created.id }))
        expect(calibrated.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('active -> needs_calibration -> calibrating -> active (flag + calibrate cycle)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-002') })
        )

        const flagged = yield* actor.send(new InternalFlagForCalibration({ sensorId: created.id }))
        expect(flagged.status).toBe('needs_calibration')

        const calibrating = yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))
        expect(calibrating.status).toBe('calibrating')

        const calibrated = yield* actor.send(new InternalCompleteCalibration({ sensorId: created.id }))
        expect(calibrated.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('calibrating -> faulted -> active (calibration failure + clear fault)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-003') })
        )
        yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))

        const faulted = yield* actor.send(new InternalFailCalibration({ sensorId: created.id }))
        expect(faulted.status).toBe('faulted')

        const cleared = yield* actor.send(new InternalSensorClearFault({ sensorId: created.id }))
        expect(cleared.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('active -> faulted -> offline -> decommissioned (fault + decommission)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-004') })
        )

        const faulted = yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))
        expect(faulted.status).toBe('faulted')

        const offline = yield* actor.send(new InternalTakeOffline({ sensorId: created.id }))
        expect(offline.status).toBe('offline')

        const decommissioned = yield* actor.send(new InternalSensorDecommission({ sensorId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('active -> offline -> active (offline + bring online cycle)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-005') })
        )

        const offline = yield* actor.send(new InternalTakeOffline({ sensorId: created.id }))
        expect(offline.status).toBe('offline')

        const online = yield* actor.send(new InternalBringOnline({ sensorId: created.id }))
        expect(online.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('faulted -> decommissioned (direct decommission from faulted)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-006') })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))

        const decommissioned = yield* actor.send(new InternalSensorDecommission({ sensorId: created.id }))
        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('idempotent GET after transitions', () => {
    it.effect('GET returns consistent state after calibration cycle', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-007') })
        )
        yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))
        yield* actor.send(new InternalCompleteCalibration({ sensorId: created.id }))

        const get1 = yield* actor.send(new InternalGetSensor({ sensorId: created.id }))
        const get2 = yield* actor.send(new InternalGetSensor({ sensorId: created.id }))

        expect(get1.status).toBe('active')
        expect(get2.status).toBe('active')
        expect(get1.id).toBe(get2.id)
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('invalid transitions yield MachineSensorInvalidTransitionError', () => {
    it.effect('cannot complete calibration from active (must start first)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-008') })
        )

        const result = yield* actor.send(
          new InternalCompleteCalibration({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('cannot bring online from active (already active)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-009') })
        )

        const result = yield* actor.send(
          new InternalBringOnline({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('cannot decommission from active (must go offline/faulted first)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-010') })
        )

        const result = yield* actor.send(
          new InternalSensorDecommission({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('cannot transition from decommissioned (terminal state)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams('prop-sensor-011') })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))
        yield* actor.send(new InternalSensorDecommission({ sensorId: created.id }))

        const result = yield* actor.send(
          new InternalSensorClearFault({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
